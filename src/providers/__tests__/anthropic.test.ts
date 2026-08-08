import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { anthropicProvider } from '@/providers/anthropic'
import { ProviderError } from '@/providers/errors'
import { providerRegistry } from '@/providers/registry'
import type { ChatRequest } from '@/types/provider'

function anthropicSseBody(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line))
      controller.close()
    },
  })
}

function makeRequest(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    model: 'claude-sonnet-4-5',
    messages: [
      { id: 'm1', role: 'user', content: 'Hi', status: 'complete', createdAt: Date.now() },
    ],
    ...overrides,
  }
}

describe('anthropicProvider', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('metadata + registration', () => {
    it('declares the correct capabilities: streaming, vision, and reasoning true; everything else default-false', () => {
      expect(anthropicProvider.meta.id).toBe('anthropic')
      expect(anthropicProvider.meta.requiresKey).toBe(true)
      expect(anthropicProvider.meta.capabilities).toEqual({
        streaming: true,
        vision: true,
        reasoning: true,
        documentInput: false,
        toolCalling: false,
        structuredOutput: false,
        webSearch: false,
        mcp: false,
        embeddings: false,
        imageGeneration: false,
      })
    })

    it('exposes an apiKey field and an optional proxyUrl field', () => {
      expect(anthropicProvider.meta.credentialFields).toEqual([
        expect.objectContaining({ key: 'apiKey', type: 'apiKey' }),
        expect.objectContaining({ key: 'proxyUrl', type: 'baseUrl' }),
      ])
    })

    it('registers into the provider registry like any other ChatProvider', () => {
      const id = `anthropic-test-${crypto.randomUUID()}`
      const clone = { ...anthropicProvider, meta: { ...anthropicProvider.meta, id } }
      expect(() => providerRegistry.register(clone)).not.toThrow()
      expect(providerRegistry.get(id)).toBe(clone)
    })
  })

  describe('validateKey / listModels', () => {
    it('validateKey returns valid:true on 200', async () => {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      const result = await anthropicProvider.validateKey({ apiKey: 'sk-ant-good' })
      expect(result.valid).toBe(true)
    })

    it('validateKey returns valid:false with a friendly message on 401', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            type: 'error',
            error: { type: 'authentication_error', message: 'bad key' },
          }),
          { status: 401 }
        )
      )
      const result = await anthropicProvider.validateKey({ apiKey: 'sk-ant-bad' })
      expect(result.valid).toBe(false)
      expect(result.message).toMatch(/rejected/i)
    })

    it('listModels maps display_name into ModelInfo.name, falling back to id', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              { id: 'claude-sonnet-4-5', display_name: 'Claude Sonnet 4.5' },
              { id: 'claude-haiku-4-5' },
            ],
          }),
          { status: 200 }
        )
      )
      const models = await anthropicProvider.listModels({ apiKey: 'sk-ant-good' })
      expect(models).toEqual([
        { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
        { id: 'claude-haiku-4-5', name: 'claude-haiku-4-5' },
      ])
    })
  })

  describe('error normalization', () => {
    const cases: Array<[string, number, string | undefined, string]> = [
      ['authentication_error -> invalid_api_key', 401, 'authentication_error', 'invalid_api_key'],
      ['not_found_error -> unsupported_model', 404, 'not_found_error', 'unsupported_model'],
      ['rate_limit_error -> rate_limited', 429, 'rate_limit_error', 'rate_limited'],
      ['overloaded_error -> network_error', 529, 'overloaded_error', 'network_error'],
    ]

    it.each(cases)('%s', async (_label, status, errorType, expectedCode) => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ type: 'error', error: { type: errorType, message: 'x' } }), {
          status,
        })
      )
      await expect(anthropicProvider.listModels({ apiKey: 'k' })).rejects.toMatchObject({
        code: expectedCode,
      })
    })

    it('falls back to HTTP-status classification when the error body has no recognized type', async () => {
      fetchMock.mockResolvedValueOnce(new Response('gateway timeout', { status: 504 }))
      await expect(anthropicProvider.listModels({ apiKey: 'k' })).rejects.toMatchObject({
        code: 'network_error',
      })
    })

    it('normalizes a network failure (fetch throws) into network_error', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      const iterate = async () => {
        for await (const _chunk of anthropicProvider.streamMessage(makeRequest(), {
          apiKey: 'k',
        })) {
          void _chunk
        }
      }
      let caught: unknown
      try {
        await iterate()
      } catch (err) {
        caught = err
      }
      expect(caught).toBeInstanceOf(ProviderError)
      expect((caught as InstanceType<typeof ProviderError>).code).toBe('network_error')
    })
  })

  describe('streamMessage — Anthropic\u2019s named-event SSE format', () => {
    it('yields text deltas from content_block_delta events and stops cleanly at message_stop', async () => {
      const body = anthropicSseBody([
        'event: message_start\ndata: {"type":"message_start"}\n\n',
        'event: content_block_start\ndata: {"type":"content_block_start","index":0}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hel"}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"lo"}}\n\n',
        'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
        'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n',
        'event: message_stop\ndata: {"type":"message_stop"}\n\n',
      ])
      fetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }))

      const chunks = []
      for await (const chunk of anthropicProvider.streamMessage(makeRequest(), { apiKey: 'k' })) {
        chunks.push(chunk)
      }

      const textChunks = chunks.filter((c) => c.type === 'text')
      expect(textChunks.map((c) => c.textDelta).join('')).toBe('Hello')
      expect(chunks[chunks.length - 1]?.type).toBe('done')
    })

    it('yields reasoning deltas from thinking_delta events', async () => {
      const body = anthropicSseBody([
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"Let me consider..."}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Answer"}}\n\n',
        'event: message_stop\ndata: {"type":"message_stop"}\n\n',
      ])
      fetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }))

      const chunks = []
      for await (const chunk of anthropicProvider.streamMessage(makeRequest(), { apiKey: 'k' })) {
        chunks.push(chunk)
      }

      const reasoningChunks = chunks.filter((c) => c.type === 'reasoning')
      expect(reasoningChunks[0]?.reasoningDelta).toBe('Let me consider...')
      expect(chunks.filter((c) => c.type === 'text')[0]?.textDelta).toBe('Answer')
    })

    it('throws a normalized ProviderError on a mid-stream error event', async () => {
      const body = anthropicSseBody([
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Partial"}}\n\n',
        'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n\n',
      ])
      fetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }))

      const iterate = async () => {
        for await (const _chunk of anthropicProvider.streamMessage(makeRequest(), {
          apiKey: 'k',
        })) {
          void _chunk
        }
      }
      await expect(iterate()).rejects.toMatchObject({ code: 'network_error' })
    })

    it('throws a normalized ProviderError when the initial response is not OK', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            type: 'error',
            error: { type: 'authentication_error', message: 'bad' },
          }),
          { status: 401 }
        )
      )
      const iterate = async () => {
        for await (const _chunk of anthropicProvider.streamMessage(makeRequest(), {
          apiKey: 'bad',
        })) {
          void _chunk
        }
      }
      await expect(iterate()).rejects.toMatchObject({ code: 'invalid_api_key' })
    })
  })

  describe('sendMessage (non-streaming)', () => {
    it('joins text blocks and separately surfaces thinking blocks as reasoningTrace', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: [
              { type: 'thinking', thinking: 'Reasoning through it' },
              { type: 'text', text: 'Final answer' },
            ],
            usage: { input_tokens: 10, output_tokens: 4 },
          }),
          { status: 200 }
        )
      )

      const response = await anthropicProvider.sendMessage(makeRequest(), { apiKey: 'k' })
      expect(response.content).toBe('Final answer')
      expect(response.reasoningTrace).toBe('Reasoning through it')
      expect(response.usage).toEqual({ inputTokens: 10, outputTokens: 4 })
    })
  })

  describe('vision request formatting', () => {
    it('formats an image attachment as an Anthropic image content block alongside text', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ content: [{ type: 'text', text: 'I see a cat.' }] }), {
          status: 200,
        })
      )

      const request = makeRequest({
        messages: [
          {
            id: 'm1',
            role: 'user',
            content: 'What is in this image?',
            status: 'complete',
            createdAt: Date.now(),
            attachments: [
              {
                id: 'a1',
                kind: 'image',
                name: 'cat.png',
                mimeType: 'image/png',
                data: 'ZmFrZS1iYXNlNjQtZGF0YQ==',
                sizeBytes: 123,
              },
            ],
          },
        ],
      })

      await anthropicProvider.sendMessage(request, { apiKey: 'k' })

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
      const body = JSON.parse(options.body as string)
      expect(body.messages[0].content).toEqual([
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/png', data: 'ZmFrZS1iYXNlNjQtZGF0YQ==' },
        },
        { type: 'text', text: 'What is in this image?' },
      ])
    })

    it('sends plain string content when there are no attachments', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ content: [{ type: 'text', text: 'Hi' }] }), { status: 200 })
      )

      await anthropicProvider.sendMessage(makeRequest(), { apiKey: 'k' })

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
      const body = JSON.parse(options.body as string)
      expect(body.messages[0].content).toBe('Hi')
    })
  })

  describe('reasoning (thinking) request formatting', () => {
    it('includes a thinking block and omits temperature/top_p when reasoningEffort is set', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ content: [{ type: 'text', text: 'ok' }] }), { status: 200 })
      )

      await anthropicProvider.sendMessage(
        makeRequest({ reasoningEffort: 'high', temperature: 0.9, topP: 0.8 }),
        { apiKey: 'k' }
      )

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
      const body = JSON.parse(options.body as string)
      expect(body.thinking).toEqual({ type: 'enabled', budget_tokens: 1024 })
      expect(body.temperature).toBeUndefined()
      expect(body.top_p).toBeUndefined()
    })

    it('includes temperature/top_p normally when reasoningEffort is not set', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ content: [{ type: 'text', text: 'ok' }] }), { status: 200 })
      )

      await anthropicProvider.sendMessage(makeRequest({ temperature: 0.9, topP: 0.8 }), {
        apiKey: 'k',
      })

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
      const body = JSON.parse(options.body as string)
      expect(body.thinking).toBeUndefined()
      expect(body.temperature).toBe(0.9)
      expect(body.top_p).toBe(0.8)
    })

    it('always sends max_tokens, defaulting when the request does not specify one', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ content: [{ type: 'text', text: 'ok' }] }), { status: 200 })
      )
      await anthropicProvider.sendMessage(makeRequest(), { apiKey: 'k' })
      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
      const body = JSON.parse(options.body as string)
      expect(body.max_tokens).toBe(4096)
    })
  })

  describe('direct vs. proxy mode', () => {
    it('calls api.anthropic.com directly and sends the direct-browser-access header when no proxyUrl is set', async () => {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      await anthropicProvider.validateKey({ apiKey: 'k' })

      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('https://api.anthropic.com/v1/models')
      const headers = options.headers as Record<string, string>
      expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true')
      expect(headers['x-api-key']).toBe('k')
    })

    it('routes through the proxy URL and omits the direct-browser-access header when proxyUrl is set', async () => {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      await anthropicProvider.validateKey({
        apiKey: 'k',
        proxyUrl: 'https://my-proxy.example.com/',
      })

      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('https://my-proxy.example.com/models')
      const headers = options.headers as Record<string, string>
      expect(headers['anthropic-dangerous-direct-browser-access']).toBeUndefined()
      expect(headers['x-api-key']).toBe('k') // still sent — lets a pass-through proxy work with no server config
    })
  })

  it('passes the AbortSignal through to fetch', async () => {
    fetchMock.mockResolvedValue(
      new Response(anthropicSseBody(['event: message_stop\ndata: {"type":"message_stop"}\n\n']), {
        status: 200,
      })
    )
    const controller = new AbortController()
    for await (const _chunk of anthropicProvider.streamMessage(
      makeRequest({ signal: controller.signal }),
      { apiKey: 'k' }
    )) {
      void _chunk
    }
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(options.signal).toBe(controller.signal)
  })
})
