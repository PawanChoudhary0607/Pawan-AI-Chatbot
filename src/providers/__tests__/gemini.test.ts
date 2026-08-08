import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { geminiProvider } from '@/providers/gemini'

describe('geminiProvider', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('declares correct metadata', () => {
    expect(geminiProvider.meta.id).toBe('gemini')
    expect(geminiProvider.meta.requiresKey).toBe(true)
    expect(geminiProvider.meta.isLocal).toBe(false)
    expect(geminiProvider.meta.capabilities.streaming).toBe(true)
    expect(geminiProvider.meta.credentialFields).toEqual([
      expect.objectContaining({ key: 'apiKey', type: 'apiKey' }),
    ])
  })

  it('calls the Google OpenAI-compatible endpoint with a Bearer token', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))

    await geminiProvider.validateKey({ apiKey: 'AIza-test-key' })

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/openai/models')
    expect((options.headers as Record<string, string>).Authorization).toBe('Bearer AIza-test-key')
  })

  it('maps the raw /models response into normalized ModelInfo', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ id: 'models/gemini-2.0-flash' }] }), { status: 200 })
    )

    const models = await geminiProvider.listModels({ apiKey: 'AIza-test-key' })
    expect(models).toEqual([{ id: 'models/gemini-2.0-flash', name: 'models/gemini-2.0-flash' }])
  })

  it('reports an invalid key with a normalized message on 401', async () => {
    fetchMock.mockResolvedValueOnce(new Response('unauthorized', { status: 401 }))

    const result = await geminiProvider.validateKey({ apiKey: 'bad-key' })
    expect(result.valid).toBe(false)
    expect(result.message).toMatch(/rejected/i)
  })
})
