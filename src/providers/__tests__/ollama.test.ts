import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ollamaProvider } from '@/providers/ollama'

describe('ollamaProvider', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('declares correct metadata: local, no key required', () => {
    expect(ollamaProvider.meta.id).toBe('ollama')
    expect(ollamaProvider.meta.isLocal).toBe(true)
    expect(ollamaProvider.meta.requiresKey).toBe(false)
    expect(ollamaProvider.meta.credentialFields).toEqual([
      expect.objectContaining({ key: 'baseUrl', type: 'baseUrl' }),
    ])
  })

  it('defaults to http://localhost:11434/v1 when no baseUrl credential is set', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))

    await ollamaProvider.validateKey({})

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:11434/v1/models')
  })

  it('uses a custom baseUrl credential when provided, normalizing a trailing slash', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))

    await ollamaProvider.validateKey({ baseUrl: 'http://192.168.1.50:11434/' })

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://192.168.1.50:11434/v1/models')
  })

  it('sends no Authorization header', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))

    await ollamaProvider.validateKey({})

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((options.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('reports a connection failure as a normalized network error when unreachable', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const result = await ollamaProvider.validateKey({})
    expect(result.valid).toBe(false)
    expect(result.message).toMatch(/network/i)
  })

  it('maps model ids from the /models response', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ id: 'llama3:latest' }] }), { status: 200 })
    )

    const models = await ollamaProvider.listModels({})
    expect(models).toEqual([{ id: 'llama3:latest', name: 'llama3:latest' }])
  })
})
