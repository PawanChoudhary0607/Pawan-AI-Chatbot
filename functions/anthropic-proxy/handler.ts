/**
 * Optional Anthropic proxy.
 *
 * Purpose (per the approved architecture): let the app call Anthropic from
 * a browser without CORS trouble, and optionally hide the API key from the
 * client entirely if the deployer configures ANTHROPIC_API_KEY as a server
 * secret. Completely stateless — no logging, no storage, nothing persists
 * between requests. The app works with or without this deployed; the
 * Anthropic adapter (src/providers/anthropic.ts) talks directly to
 * api.anthropic.com by default and only routes through this proxy if the
 * user fills in a "Proxy URL" in Settings.
 */

const ANTHROPIC_API_BASE = 'https://api.anthropic.com/v1'
const ALLOWED_PATHS = ['/messages', '/models']

export interface ProxyEnv {
  /** If set, used for every request and the client's own x-api-key header
   * is ignored — this is what actually hides the key from the browser. If
   * unset, the client's x-api-key is forwarded as-is (still avoids CORS,
   * but the key remains visible to that client, same as calling Anthropic
   * directly with the direct-browser-access header). */
  ANTHROPIC_API_KEY?: string
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'content-type, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access',
  }
}

function matchAllowedPath(pathname: string): string | null {
  return ALLOWED_PATHS.find((p) => pathname === p || pathname.endsWith(p)) ?? null
}

export async function handleAnthropicProxyRequest(
  request: Request,
  env: ProxyEnv = {}
): Promise<Response> {
  const origin = request.headers.get('origin')

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }

  const url = new URL(request.url)
  const targetPath = matchAllowedPath(url.pathname)
  if (!targetPath) {
    return new Response(JSON.stringify({ error: 'Unsupported proxy path' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    })
  }

  const apiKey = env.ANTHROPIC_API_KEY || request.headers.get('x-api-key') || ''
  const anthropicVersion = request.headers.get('anthropic-version') ?? '2023-06-01'

  const upstreamResponse = await fetch(`${ANTHROPIC_API_BASE}${targetPath}`, {
    method: request.method,
    headers: {
      'content-type': 'application/json',
      'anthropic-version': anthropicVersion,
      'x-api-key': apiKey,
    },
    body: request.method === 'POST' ? await request.text() : undefined,
  })

  const responseHeaders = new Headers(upstreamResponse.headers)
  Object.entries(corsHeaders(origin)).forEach(([key, value]) => responseHeaders.set(key, value))

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  })
}
