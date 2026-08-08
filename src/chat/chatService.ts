import { eventBus } from '@/events/eventBus'
import { providerRegistry } from '@/providers/registry'
import { ProviderError } from '@/providers/errors'
import { useConversationStore } from '@/state/conversationStore'
import { useSettingsStore } from '@/state/settingsStore'
import type { Attachment, ChatMessage } from '@/types/provider'

function makeId(): string {
  return crypto.randomUUID()
}

function friendlyFallbackMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return 'The response stream was interrupted before it finished.'
}

/**
 * Orchestrates the send -> stream -> persist lifecycle. This is the ONLY
 * code that calls a ChatProvider's sendMessage/streamMessage — it resolves
 * the provider generically via providerRegistry.get(conversation.providerId)
 * and never branches on which provider it got back. UI components call
 * chatService.sendUserMessage()/stopStreaming()/retryMessage(); they never
 * touch a provider or the registry directly.
 */
class ChatService {
  private abortControllers = new Map<string, AbortController>() // keyed by conversationId

  isStreaming(conversationId: string): boolean {
    return this.abortControllers.has(conversationId)
  }

  stopStreaming(conversationId: string): void {
    this.abortControllers.get(conversationId)?.abort()
  }

  async sendUserMessage(
    conversationId: string,
    content: string,
    attachments?: Attachment[]
  ): Promise<void> {
    const trimmed = content.trim()
    const hasAttachments = Boolean(attachments && attachments.length > 0)
    if (!trimmed && !hasAttachments) return
    if (this.isStreaming(conversationId)) return // one in-flight stream per conversation

    const conversationStore = useConversationStore.getState()
    const conversation = conversationStore.conversations[conversationId]
    if (!conversation) return

    const userMessage: ChatMessage = {
      id: makeId(),
      role: 'user',
      content: trimmed,
      status: 'complete',
      createdAt: Date.now(),
      ...(hasAttachments ? { attachments } : {}),
    }
    conversationStore.appendMessage(conversationId, userMessage)

    const assistantId = makeId()
    conversationStore.appendMessage(conversationId, {
      id: assistantId,
      role: 'assistant',
      content: '',
      status: 'streaming',
      createdAt: Date.now(),
    })

    // History for the request = everything up to and including the user
    // message just sent (not the empty assistant placeholder).
    const history = [...conversation.messages, userMessage]
    await this.runStream(conversationId, assistantId, history)
  }

  /**
   * Retries a failed (or otherwise unwanted-result) assistant message
   * in place: re-runs the provider call using the same preceding message
   * history and streams the new result into the SAME message id, rather
   * than appending a duplicate user message. Only valid for a message
   * whose status is 'error'.
   */
  async retryMessage(conversationId: string, messageId: string): Promise<void> {
    if (this.isStreaming(conversationId)) return

    const conversation = useConversationStore.getState().conversations[conversationId]
    if (!conversation) return
    const targetIndex = conversation.messages.findIndex((m) => m.id === messageId)
    if (targetIndex === -1) return
    const target = conversation.messages[targetIndex]
    if (target.role !== 'assistant' || target.status !== 'error') return

    const history = conversation.messages.slice(0, targetIndex)
    useConversationStore
      .getState()
      .updateMessage(conversationId, messageId, { content: '', status: 'streaming' })

    await this.runStream(conversationId, messageId, history)
  }

  /** Shared by sendUserMessage and retryMessage: resolves the provider,
   * streams the response into the given message id, and normalizes every
   * outcome (complete/stopped/error) the same way regardless of caller. */
  private async runStream(
    conversationId: string,
    assistantId: string,
    history: ChatMessage[]
  ): Promise<void> {
    const conversation = useConversationStore.getState().conversations[conversationId]
    if (!conversation) return

    const provider = providerRegistry.get(conversation.providerId)
    if (!provider) {
      useConversationStore.getState().updateMessage(conversationId, assistantId, {
        status: 'error',
        content:
          'No provider is selected for this conversation. Choose a provider and model above, then try again.',
      })
      return
    }
    if (!conversation.model) {
      useConversationStore.getState().updateMessage(conversationId, assistantId, {
        status: 'error',
        content:
          'No model is selected for this conversation. Choose a model above, then try again.',
      })
      return
    }

    const credentials = useSettingsStore.getState().credentials[provider.meta.id] ?? {}
    const controller = new AbortController()
    this.abortControllers.set(conversationId, controller)
    eventBus.emit('stream.started', { conversationId, messageId: assistantId })

    let accumulated = ''
    try {
      const chunks = provider.streamMessage(
        {
          model: conversation.model,
          messages: history,
          systemPrompt: conversation.systemPrompt,
          temperature: conversation.temperature,
          topP: conversation.topP,
          maxTokens: conversation.maxTokens,
          signal: controller.signal,
        },
        credentials
      )

      for await (const chunk of chunks) {
        if (chunk.type === 'text' && chunk.textDelta) {
          accumulated += chunk.textDelta
          // Store updates on every chunk (live UI); persistence writes stay
          // debounced independently via persistenceService's existing
          // 'message.updated' handling — this loop never touches storage.
          useConversationStore.getState().updateMessage(conversationId, assistantId, {
            content: accumulated,
            status: 'streaming',
          })
          eventBus.emit('stream.chunk', {
            conversationId,
            messageId: assistantId,
            textDelta: chunk.textDelta,
          })
        } else if (chunk.type === 'error') {
          throw new ProviderError({
            code: 'unknown',
            message: chunk.error ?? 'The provider reported an error.',
            providerId: provider.meta.id,
          })
        }
      }

      useConversationStore
        .getState()
        .updateMessage(conversationId, assistantId, { status: 'complete' })
      // A well-behaved adapter catches AbortError internally and just
      // returns (ending the generator cleanly) rather than throwing — so
      // the loop above can finish "normally" even when the user hit Stop.
      // Checking the signal here (not just in the catch block below) is
      // what correctly distinguishes "provider finished" from "user
      // stopped" for adapters that behave that way.
      if (controller.signal.aborted) {
        eventBus.emit('stream.stopped', { conversationId, messageId: assistantId })
      } else {
        eventBus.emit('stream.completed', { conversationId, messageId: assistantId })
      }
    } catch (err) {
      if (controller.signal.aborted) {
        // User-initiated stop, for adapters that instead throw AbortError
        // rather than swallowing it — keep whatever partial content
        // streamed in, mark it settled rather than errored.
        useConversationStore
          .getState()
          .updateMessage(conversationId, assistantId, { status: 'complete' })
        eventBus.emit('stream.stopped', { conversationId, messageId: assistantId })
      } else {
        const message = err instanceof ProviderError ? err.message : friendlyFallbackMessage(err)
        useConversationStore.getState().updateMessage(conversationId, assistantId, {
          status: 'error',
          content: accumulated ? `${accumulated}\n\n_${message}_` : message,
        })
        eventBus.emit('stream.error', { conversationId, messageId: assistantId, error: message })
      }
    } finally {
      this.abortControllers.delete(conversationId)
    }
  }
}

export const chatService = new ChatService()
