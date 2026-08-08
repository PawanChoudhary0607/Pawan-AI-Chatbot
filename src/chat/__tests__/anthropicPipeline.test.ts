import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { providerRegistry } from '@/providers/registry'
import { anthropicProvider } from '@/providers/anthropic'
import { useConversationStore } from '@/state/conversationStore'
import { useSettingsStore } from '@/state/settingsStore'
import { eventBus } from '@/events/eventBus'
import { chatService } from '@/chat/chatService'

function anthropicSseBody(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line))
      controller.close()
    },
  })
}

describe('chatService + Anthropic (native SSE format, proves identical pipeline behavior)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    useConversationStore.setState({ conversations: {}, activeConversationId: null })
    if (!providerRegistry.has('anthropic')) {
      providerRegistry.register(anthropicProvider)
    }
    useSettingsStore.getState().setCredentials('anthropic', { apiKey: 'sk-ant-test' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('streams a response through the real Anthropic adapter and marks it complete, identically to the OpenAI-compatible providers', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        anthropicSseBody([
          'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi "}}\n\n',
          'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"there"}}\n\n',
          'event: message_stop\ndata: {"type":"message_stop"}\n\n',
        ]),
        { status: 200 }
      )
    )

    const convId = useConversationStore
      .getState()
      .createConversation('anthropic', 'claude-sonnet-4-5')

    const seenEvents: string[] = []
    const unsubs = [
      eventBus.on('stream.started', () => seenEvents.push('started')),
      eventBus.on('stream.completed', () => seenEvents.push('completed')),
    ]

    await chatService.sendUserMessage(convId, 'Hello')
    unsubs.forEach((u) => u())

    const conversation = useConversationStore.getState().conversations[convId]
    expect(conversation.messages[1].content).toBe('Hi there')
    expect(conversation.messages[1].status).toBe('complete')
    expect(seenEvents).toEqual(['started', 'completed'])
  })

  it('normalizes an Anthropic error into the same error UX as every other provider', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          type: 'error',
          error: { type: 'rate_limit_error', message: 'slow down' },
        }),
        { status: 429 }
      )
    )

    const convId = useConversationStore
      .getState()
      .createConversation('anthropic', 'claude-sonnet-4-5')

    await chatService.sendUserMessage(convId, 'Hello')

    const conversation = useConversationStore.getState().conversations[convId]
    const assistantMessage = conversation.messages[1]
    expect(assistantMessage.status).toBe('error')
    expect(assistantMessage.content).toMatch(/rate-limited/i)
  })

  it('stop generation works identically: partial content kept, status complete, stream.stopped fires', async () => {
    // A stream that yields once then hangs until aborted, mimicking a slow
    // real connection — same shape as the stoppable fake provider used for
    // the other providers' pipeline tests.
    const encoder = new TextEncoder()
    let controllerRef: ReadableStreamDefaultController<Uint8Array>
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controllerRef = controller
        controller.enqueue(
          encoder.encode(
            'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Par"}}\n\n'
          )
        )
        // Deliberately never closes — the abort is what ends this stream.
      },
    })
    fetchMock.mockImplementationOnce((_url: string, options: RequestInit) => {
      return new Promise((resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          controllerRef.error(new DOMException('Aborted', 'AbortError'))
          reject(new DOMException('Aborted', 'AbortError'))
        })
        resolve(new Response(body, { status: 200 }))
      })
    })

    const convId = useConversationStore
      .getState()
      .createConversation('anthropic', 'claude-sonnet-4-5')

    const seenEvents: string[] = []
    const unsub = eventBus.on('stream.stopped', () => seenEvents.push('stopped'))

    const sendPromise = chatService.sendUserMessage(convId, 'Hello')
    await new Promise((resolve) => setTimeout(resolve, 20))
    chatService.stopStreaming(convId)
    await sendPromise
    unsub()

    const conversation = useConversationStore.getState().conversations[convId]
    const assistantMessage = conversation.messages[1]
    expect(assistantMessage.status).toBe('complete')
    expect(assistantMessage.content).toBe('Par')
    expect(seenEvents).toEqual(['stopped'])
  })
})
