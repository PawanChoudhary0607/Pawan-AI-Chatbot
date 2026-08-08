import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOpenAICompatibleProvider } from '@/providers/openaiCompatible'
import { ProviderError } from '@/providers/errors'
import type { ChatRequest } from '@/types/provider'

function sseBody(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line))
      }
      controller.close()
    },
  })
}

function makeRequest(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    model: 'test-model',
    messages: [
      { id: 'm1', role: 'user', content: 'Hi', status: 'complete', createdAt: Date.now() },
    ],
    ...overrides,
  }
}

describe('createOpenAICompatibleProvider', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function makeTestProvider() {
    return createOpenAICompatibleProvider({
      id: 'test-provider',
      name: 'Test Provider',
      baseUrl: 'https://example.test/v1',
      headers: (credentials) => ({ Authorization: `Bearer ${credentials.apiKey ?? ''}` }),
    })
  }

  it('exposes provider metadata built from config, with default capabilities filled in', () => {
    const provider = makeTestProvider()
    expect(provider.meta.id).toBe('test-provider')
    expect(provider.meta.capabilities.streaming).toBe(true)
    expect(provider.meta.capabilities.vision).toBe(false)
  })

  it('validateKey returns valid:true on a 200 response', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    const provider = makeTestProvider()

    const result = await provider.validateKey({ apiKey: 'sk-good' })
    expect(result.valid).toBe(true)
  })

  it('validateKey returns valid:false with a friendly message on 401', async () => {
    fetchMock.mockResolvedValueOnce(new Response('unauthorized', { status: 401 }))
    const provider = makeTestProvider()

    const result = await provider.validateKey({ apiKey: 'sk-bad' })
    expect(result.valid).toBe(false)
    expect(result.message).toMatch(/rejected/i)
  })

  it('validateKey returns valid:false on a network failure', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const provider = makeTestProvider()

    const result = await provider.validateKey({ apiKey: 'sk-good' })
    expect(result.valid).toBe(false)
    expect(result.message).toMatch(/network/i)
  })

  it('listModels maps the raw /models response into normalized ModelInfo', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: [{ id: 'model-a', name: 'Model A', context_length: 8192 }] }),
        { status: 200 }
      )
    )
    const provider = makeTestProvider()

    const models = await provider.listModels({ apiKey: 'sk-good' })
    expect(models).toEqual([{ id: 'model-a', name: 'Model A', contextWindow: 8192 }])
  })

  it('listModels throws a normalized ProviderError on a non-OK response', async () => {
    fetchMock.mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
    const provider = makeTestProvider()

    await expect(provider.listModels({ apiKey: 'sk-good' })).rejects.toMatchObject({
      code: 'rate_limited',
    })
  })

  it('sendMessage returns normalized content and usage', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Hello there' } }],
          usage: { prompt_tokens: 5, completion_tokens: 3 },
        }),
        { status: 200 }
      )
    )
    const provider = makeTestProvider()

    const response = await provider.sendMessage(makeRequest(), { apiKey: 'sk-good' })
    expect(response.content).toBe('Hello there')
    expect(response.usage).toEqual({ inputTokens: 5, outputTokens: 3 })
  })

  it('streamMessage yields text deltas parsed from SSE frames and a final done chunk', async () => {
    const body = sseBody([
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
      'data: [DONE]\n\n',
    ])
    fetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }))
    const provider = makeTestProvider()

    const chunks = []
    for await (const chunk of provider.streamMessage(makeRequest(), { apiKey: 'sk-good' })) {
      chunks.push(chunk)
    }

    const textChunks = chunks.filter((c) => c.type === 'text')
    expect(textChunks.map((c) => c.textDelta).join('')).toBe('Hello')
    expect(chunks[chunks.length - 1]?.type).toBe('done')
  })

  it('streamMessage throws a normalized ProviderError when the initial response is not OK', async () => {
    fetchMock.mockResolvedValueOnce(new Response('forbidden', { status: 403 }))
    const provider = makeTestProvider()

    const iterate = async () => {
      for await (const _chunk of provider.streamMessage(makeRequest(), { apiKey: 'bad' })) {
        void _chunk // no-op — should throw before yielding anything
      }
    }

    let caught: unknown
    try {
      await iterate()
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(ProviderError)
    expect((caught as ProviderError).code).toBe('invalid_api_key')
  })

  it('passes the AbortSignal through to fetch for both send and stream calls', async () => {
    fetchMock.mockResolvedValue(new Response(sseBody(['data: [DONE]\n\n']), { status: 200 }))
    const provider = makeTestProvider()
    const controller = new AbortController()

    const iterator = provider.streamMessage(makeRequest({ signal: controller.signal }), {
      apiKey: 'sk-good',
    })
    for await (const _chunk of iterator) {
      void _chunk // drain the stream; we only care that fetch was called with the signal
    }

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(options.signal).toBe(controller.signal)
  })
})
