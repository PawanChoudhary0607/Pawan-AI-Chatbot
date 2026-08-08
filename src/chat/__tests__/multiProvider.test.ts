import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { providerRegistry } from '@/providers/registry'
import { openRouterProvider } from '@/providers/openrouter'
import { geminiProvider } from '@/providers/gemini'
import { ollamaProvider } from '@/providers/ollama'
import { useConversationStore } from '@/state/conversationStore'
import { useSettingsStore } from '@/state/settingsStore'
import { chatService } from '@/chat/chatService'

function sseBody(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line))
      controller.close()
    },
  })
}

const PROVIDERS = [
  { name: 'OpenRouter', provider: openRouterProvider, credentials: { apiKey: 'sk-or-test' } },
  { name: 'Gemini', provider: geminiProvider, credentials: { apiKey: 'AIza-test' } },
  { name: 'Ollama', provider: ollamaProvider, credentials: {} },
]

describe.each(PROVIDERS)(
  'chatService + $name (identical pipeline, no provider-specific logic)',
  ({ provider, credentials }) => {
    const fetchMock = vi.fn()

    beforeEach(() => {
      fetchMock.mockReset()
      vi.stubGlobal('fetch', fetchMock)
      useConversationStore.setState({ conversations: {}, activeConversationId: null })
      if (!providerRegistry.has(provider.meta.id)) {
        providerRegistry.register(provider)
      }
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('streams a real response through the adapter and marks it complete', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          sseBody([
            'data: {"choices":[{"delta":{"content":"Hi "}}]}\n\n',
            'data: {"choices":[{"delta":{"content":"there"}}]}\n\n',
            'data: [DONE]\n\n',
          ]),
          { status: 200 }
        )
      )

      const convId = useConversationStore
        .getState()
        .createConversation(provider.meta.id, 'test-model')
      useConversationStore
        .getState()
        .updateConversationProvider(convId, provider.meta.id, 'test-model')
      useSettingsStore.getState().setCredentials(provider.meta.id, credentials)

      await chatService.sendUserMessage(convId, 'Hello')

      const conversation = useConversationStore.getState().conversations[convId]
      expect(conversation.messages[1].content).toBe('Hi there')
      expect(conversation.messages[1].status).toBe('complete')
    })

    it('normalizes a 401 response into a consistent error message on the message itself', async () => {
      fetchMock.mockResolvedValueOnce(new Response('unauthorized', { status: 401 }))

      const convId = useConversationStore
        .getState()
        .createConversation(provider.meta.id, 'test-model')
      useSettingsStore.getState().setCredentials(provider.meta.id, credentials)

      await chatService.sendUserMessage(convId, 'Hello')

      const conversation = useConversationStore.getState().conversations[convId]
      const assistantMessage = conversation.messages[1]
      expect(assistantMessage.status).toBe('error')
      expect(assistantMessage.content).toMatch(/rejected/i)
    })
  }
)
