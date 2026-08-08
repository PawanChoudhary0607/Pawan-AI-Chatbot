import { beforeEach, describe, expect, it } from 'vitest'
import { providerRegistry } from '@/providers/registry'
import { ProviderError } from '@/providers/errors'
import {
  createEstimateContext,
  createEstimateCost,
  createSupportsCapability,
} from '@/providers/runtimeCapabilities'
import { useConversationStore } from '@/state/conversationStore'
import { eventBus } from '@/events/eventBus'
import { chatService } from '@/chat/chatService'
import type { ChatProvider, ProviderCapabilities } from '@/types/provider'

const NO_CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  vision: false,
  documentInput: false,
  toolCalling: false,
  structuredOutput: false,
  reasoning: false,
  webSearch: false,
  mcp: false,
  embeddings: false,
  imageGeneration: false,
}

function makeFakeProvider(
  id: string,
  behavior: 'happy' | 'error' | 'stoppable' | 'stoppable-clean'
): ChatProvider {
  return {
    meta: {
      id,
      name: 'Fake Provider',
      isLocal: false,
      requiresKey: false,
      credentialFields: [],
      capabilities: NO_CAPABILITIES,
    },
    validateKey: async () => ({ valid: true }),
    listModels: async () => [{ id: 'fake-model', name: 'Fake Model' }],
    sendMessage: async () => ({ content: 'not used in these tests' }),
    async *streamMessage(request) {
      if (behavior === 'happy') {
        yield { type: 'text' as const, textDelta: 'Hel' }
        yield { type: 'text' as const, textDelta: 'lo' }
        yield { type: 'done' as const }
        return
      }
      if (behavior === 'error') {
        throw new ProviderError({ code: 'unknown', message: 'Simulated failure', providerId: id })
      }
      if (behavior === 'stoppable') {
        // Throws on abort — mirrors a provider whose fetch/stream call
        // itself rejects with AbortError and lets it propagate.
        yield { type: 'text' as const, textDelta: 'Par' }
        while (!request.signal?.aborted) {
          await new Promise((resolve) => setTimeout(resolve, 5))
        }
        throw new DOMException('Aborted', 'AbortError')
      }
      // stoppable-clean: swallows AbortError and returns normally — this is
      // exactly how the real openaiCompatible/anthropic adapters behave,
      // and is the case that exposed the stream.completed-vs-stopped bug.
      yield { type: 'text' as const, textDelta: 'Par' }
      while (!request.signal?.aborted) {
        await new Promise((resolve) => setTimeout(resolve, 5))
      }
      return
    },
    estimateCost: createEstimateCost(),
    estimateContext: createEstimateContext(undefined),
    supportsCapability: createSupportsCapability(NO_CAPABILITIES),
  }
}

describe('chatService', () => {
  beforeEach(() => {
    useConversationStore.setState({ conversations: {}, activeConversationId: null })
  })

  it('streams a response and marks the assistant message complete', async () => {
    const providerId = `fake-happy-${crypto.randomUUID()}`
    providerRegistry.register(makeFakeProvider(providerId, 'happy'))
    const convId = useConversationStore.getState().createConversation(providerId, 'fake-model')
    useConversationStore.getState().updateConversationProvider(convId, providerId, 'fake-model')

    const seenEvents: string[] = []
    const unsubs = [
      eventBus.on('stream.started', () => seenEvents.push('started')),
      eventBus.on('stream.completed', () => seenEvents.push('completed')),
    ]

    await chatService.sendUserMessage(convId, 'Hello')
    unsubs.forEach((u) => u())

    const conversation = useConversationStore.getState().conversations[convId]
    expect(conversation.messages).toHaveLength(2)
    expect(conversation.messages[0].role).toBe('user')
    expect(conversation.messages[1].role).toBe('assistant')
    expect(conversation.messages[1].content).toBe('Hello')
    expect(conversation.messages[1].status).toBe('complete')
    expect(seenEvents).toEqual(['started', 'completed'])
  })

  it('stop generation keeps partial content, marks complete (not error), and emits stream.stopped', async () => {
    const providerId = `fake-stop-${crypto.randomUUID()}`
    providerRegistry.register(makeFakeProvider(providerId, 'stoppable'))
    const convId = useConversationStore.getState().createConversation(providerId, 'fake-model')

    const seenEvents: string[] = []
    const unsubs = [
      eventBus.on('stream.stopped', () => seenEvents.push('stopped')),
      eventBus.on('stream.error', () => seenEvents.push('error')),
    ]

    const sendPromise = chatService.sendUserMessage(convId, 'Hello')
    await new Promise((resolve) => setTimeout(resolve, 20)) // let the first chunk land
    expect(chatService.isStreaming(convId)).toBe(true)
    chatService.stopStreaming(convId)
    await sendPromise
    unsubs.forEach((u) => u())

    const conversation = useConversationStore.getState().conversations[convId]
    const assistantMessage = conversation.messages[1]
    expect(assistantMessage.status).toBe('complete')
    expect(assistantMessage.content).toBe('Par')
    expect(seenEvents).toEqual(['stopped'])
    expect(chatService.isStreaming(convId)).toBe(false)
  })

  it('regression: stop generation still reports stream.stopped (not stream.completed) when the adapter swallows AbortError and returns cleanly, like the real adapters do', async () => {
    const providerId = `fake-stop-clean-${crypto.randomUUID()}`
    providerRegistry.register(makeFakeProvider(providerId, 'stoppable-clean'))
    const convId = useConversationStore.getState().createConversation(providerId, 'fake-model')

    const seenEvents: string[] = []
    const unsubs = [
      eventBus.on('stream.stopped', () => seenEvents.push('stopped')),
      eventBus.on('stream.completed', () => seenEvents.push('completed')),
    ]

    const sendPromise = chatService.sendUserMessage(convId, 'Hello')
    await new Promise((resolve) => setTimeout(resolve, 20))
    chatService.stopStreaming(convId)
    await sendPromise
    unsubs.forEach((u) => u())

    const conversation = useConversationStore.getState().conversations[convId]
    expect(conversation.messages[1].status).toBe('complete')
    expect(conversation.messages[1].content).toBe('Par')
    expect(seenEvents).toEqual(['stopped']) // must NOT be ['completed']
  })

  it('a provider error marks the message as error and emits stream.error', async () => {
    const providerId = `fake-error-${crypto.randomUUID()}`
    providerRegistry.register(makeFakeProvider(providerId, 'error'))
    const convId = useConversationStore.getState().createConversation(providerId, 'fake-model')

    const seenEvents: string[] = []
    const unsub = eventBus.on('stream.error', () => seenEvents.push('error'))

    await chatService.sendUserMessage(convId, 'Hello')
    unsub()

    const conversation = useConversationStore.getState().conversations[convId]
    const assistantMessage = conversation.messages[1]
    expect(assistantMessage.status).toBe('error')
    expect(assistantMessage.content).toMatch(/Simulated failure/)
    expect(seenEvents).toEqual(['error'])
  })

  it('preserves the user message and appends a clear inline error when no provider is selected, without calling any provider', async () => {
    const convId = useConversationStore.getState().createConversation('', '')

    await chatService.sendUserMessage(convId, 'Hello')

    const conversation = useConversationStore.getState().conversations[convId]
    // The user's message is kept (not silently discarded) — consistent
    // with every other error path, and with retryMessage's semantics.
    expect(conversation.messages).toHaveLength(2)
    expect(conversation.messages[0]).toMatchObject({ role: 'user', content: 'Hello' })
    expect(conversation.messages[1].status).toBe('error')
    expect(conversation.messages[1].content).toMatch(/no provider/i)
  })

  it('ignores a send while a stream is already in flight for that conversation', async () => {
    const providerId = `fake-happy-${crypto.randomUUID()}`
    providerRegistry.register(makeFakeProvider(providerId, 'stoppable'))
    const convId = useConversationStore.getState().createConversation(providerId, 'fake-model')

    const first = chatService.sendUserMessage(convId, 'First')
    await new Promise((resolve) => setTimeout(resolve, 10))
    await chatService.sendUserMessage(convId, 'Second') // should be a no-op

    chatService.stopStreaming(convId)
    await first

    const conversation = useConversationStore.getState().conversations[convId]
    const userMessages = conversation.messages.filter((m) => m.role === 'user')
    expect(userMessages).toHaveLength(1)
    expect(userMessages[0].content).toBe('First')
  })
})
