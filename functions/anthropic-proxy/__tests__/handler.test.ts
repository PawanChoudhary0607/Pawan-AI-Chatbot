import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleAnthropicProxyRequest } from '../handler'

describe('handleAnthropicProxyRequest', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('responds to CORS preflight (OPTIONS) without touching upstream', async () => {
    const request = new Request('https://proxy.example.com/messages', {
      method: 'OPTIONS',
      headers: { origin: 'https://myapp.example.com' },
    })

    const response = await handleAnthropicProxyRequest(request)

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://myapp.example.com')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a path outside the allowlist without calling upstream', async () => {
    const request = new Request('https://proxy.example.com/some-other-endpoint', { method: 'GET' })

    const response = await handleAnthropicProxyRequest(request)

    expect(response.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('forwards a POST /messages request to Anthropic with the client-provided key when no server key is configured', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ content: [{ type: 'text', text: 'hi' }] }), { status: 200 })
    )

    const request = new Request('https://proxy.example.com/messages', {
      method: 'POST',
      headers: { 'x-api-key': 'client-key', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 100, messages: [] }),
    })

    const response = await handleAnthropicProxyRequest(request, {})

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect((options.headers as Record<string, string>)['x-api-key']).toBe('client-key')
    expect(response.status).toBe(200)
  })

  it('uses the server-configured key and ignores the client key when ANTHROPIC_API_KEY is set', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))

    const request = new Request('https://proxy.example.com/models', {
      method: 'GET',
      headers: { 'x-api-key': 'client-key-should-be-ignored' },
    })

    await handleAnthropicProxyRequest(request, { ANTHROPIC_API_KEY: 'server-secret-key' })

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((options.headers as Record<string, string>)['x-api-key']).toBe('server-secret-key')
  })

  it('adds CORS headers to the forwarded response', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))

    const request = new Request('https://proxy.example.com/models', {
      method: 'GET',
      headers: { origin: 'https://myapp.example.com' },
    })

    const response = await handleAnthropicProxyRequest(request)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://myapp.example.com')
  })

  it('is stateless: identical requests produce identical outcomes with no shared state between calls', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }))

    const makeRequest = () =>
      new Request('https://proxy.example.com/models', {
        method: 'GET',
        headers: { 'x-api-key': 'k' },
      })

    const first = await handleAnthropicProxyRequest(makeRequest(), {})
    const second = await handleAnthropicProxyRequest(makeRequest(), {})

    expect(first.status).toBe(second.status)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
