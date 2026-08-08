import {
  ProviderError,
  classifyHttpStatus,
  friendlyMessage,
  type ProviderErrorCode,
} from '@/providers/errors'
import { DEFAULT_CAPABILITIES } from '@/providers/defaultCapabilities'
import { deriveLimitsFromCapabilities } from '@/providers/deriveLimits'
import {
  createEstimateContext,
  createEstimateCost,
  createSupportsCapability,
} from '@/providers/runtimeCapabilities'
import type {
  ChatChunk,
  ChatMessage,
  ChatProvider,
  ChatRequest,
  ChatResponse,
  ModelInfo,
  ProviderCredentials,
  ValidationResult,
} from '@/types/provider'

const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_BASE_URL = 'https://api.anthropic.com/v1'
const DEFAULT_MAX_TOKENS = 4096
const DEFAULT_THINKING_BUDGET_TOKENS = 1024

interface AnthropicImageBlock {
  type: 'image'
  source: { type: 'base64'; media_type: string; data: string }
}
interface AnthropicTextBlock {
  type: 'text'
  text: string
}
type AnthropicContentBlock = AnthropicImageBlock | AnthropicTextBlock

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicContentBlock[]
}

interface AnthropicErrorBody {
  type?: string
  error?: { type?: string; message?: string }
}

interface AnthropicNonStreamResponse {
  content?: Array<{ type: string; text?: string; thinking?: string }>
  usage?: { input_tokens?: number; output_tokens?: number }
}

interface AnthropicModelsResponse {
  data?: Array<{ id: string; display_name?: string }>
}

function resolveBaseUrl(credentials: ProviderCredentials): string {
  const proxyUrl = credentials.proxyUrl?.trim()
  return proxyUrl ? proxyUrl.replace(/\/+$/, '') : DEFAULT_BASE_URL
}

function isUsingProxy(credentials: ProviderCredentials): boolean {
  return Boolean(credentials.proxyUrl?.trim())
}

function buildHeaders(credentials: ProviderCredentials): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': ANTHROPIC_VERSION,
    'x-api-key': credentials.apiKey ?? '',
  }
  // Anthropic's API has no CORS support for direct browser calls unless this
  // header opts in. Not needed (and not sent) when going through the
  // optional proxy, since the proxy sets its own CORS headers instead.
  if (!isUsingProxy(credentials)) {
    headers['anthropic-dangerous-direct-browser-access'] = 'true'
  }
  return headers
}

/** Maps a ChatMessage's attachments into Anthropic content blocks. Vision
 * support: the adapter can already receive image content through the
 * existing message format — no attachment UI is built this milestone, but
 * the wire format is correct today for whenever one exists. */
function buildContentBlocks(message: ChatMessage): string | AnthropicContentBlock[] {
  const imageAttachments = (message.attachments ?? []).filter((a) => a.kind === 'image')
  if (imageAttachments.length === 0) return message.content

  const blocks: AnthropicContentBlock[] = imageAttachments.map((attachment) => ({
    type: 'image',
    source: { type: 'base64', media_type: attachment.mimeType, data: attachment.data },
  }))
  if (message.content) {
    blocks.push({ type: 'text', text: message.content })
  }
  return blocks
}

function buildMessages(messages: ChatMessage[]): AnthropicMessage[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: buildContentBlocks(m) }))
}

function buildBody(request: ChatRequest, stream: boolean): Record<string, unknown> {
  // Anthropic's "extended thinking" is opt-in per request via `thinking`,
  // and while enabled, temperature/top_p must be left at their defaults
  // (the API rejects the request otherwise) — so the two are mutually
  // exclusive here rather than just additive.
  const thinkingEnabled = Boolean(request.reasoningEffort)

  return {
    model: request.model,
    max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
    stream,
    messages: buildMessages(request.messages),
    ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
    ...(thinkingEnabled
      ? { thinking: { type: 'enabled', budget_tokens: DEFAULT_THINKING_BUDGET_TOKENS } }
      : {
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          ...(request.topP !== undefined ? { top_p: request.topP } : {}),
        }),
  }
}

/** Prefers Anthropic's own error-type classification (richer than HTTP
 * status alone) and falls back to the shared status-code mapping when the
 * body doesn't parse or doesn't carry a recognized type. */
function classifyAnthropicError(
  status: number,
  body: AnthropicErrorBody | null
): ProviderErrorCode {
  switch (body?.error?.type) {
    case 'authentication_error':
      return 'invalid_api_key'
    case 'permission_error':
      return 'invalid_api_key'
    case 'not_found_error':
      return 'unsupported_model'
    case 'rate_limit_error':
      return 'rate_limited'
    case 'overloaded_error':
      return 'network_error'
    case 'api_error':
      return 'network_error'
    case 'invalid_request_error':
      return 'unknown'
    default:
      return classifyHttpStatus(status)
  }
}

async function throwNormalizedError(response: Response): Promise<never> {
  let body: AnthropicErrorBody | null = null
  try {
    body = (await response.json()) as AnthropicErrorBody
  } catch {
    // Non-JSON error body — fall back to HTTP-status classification.
  }
  const code = classifyAnthropicError(response.status, body)
  throw new ProviderError({
    code,
    message: friendlyMessage(code),
    providerId: 'anthropic',
    retryable: code === 'rate_limited' || code === 'network_error',
  })
}

async function validateKey(credentials: ProviderCredentials): Promise<ValidationResult> {
  try {
    const res = await fetch(`${resolveBaseUrl(credentials)}/models`, {
      headers: buildHeaders(credentials),
    })
    if (!res.ok) {
      const code = classifyHttpStatus(res.status)
      return { valid: false, message: friendlyMessage(code) }
    }
    return { valid: true }
  } catch {
    return { valid: false, message: friendlyMessage('network_error') }
  }
}

async function listModels(credentials: ProviderCredentials): Promise<ModelInfo[]> {
  const res = await fetch(`${resolveBaseUrl(credentials)}/models`, {
    headers: buildHeaders(credentials),
  })
  if (!res.ok) await throwNormalizedError(res)
  const json = (await res.json()) as AnthropicModelsResponse
  return (json.data ?? []).map((raw) => ({ id: raw.id, name: raw.display_name ?? raw.id }))
}

async function sendMessage(
  request: ChatRequest,
  credentials: ProviderCredentials
): Promise<ChatResponse> {
  const res = await fetch(`${resolveBaseUrl(credentials)}/messages`, {
    method: 'POST',
    headers: buildHeaders(credentials),
    body: JSON.stringify(buildBody(request, false)),
    signal: request.signal,
  })
  if (!res.ok) await throwNormalizedError(res)
  const json = (await res.json()) as AnthropicNonStreamResponse
  const blocks = json.content ?? []
  const text = blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
  const thinking = blocks
    .filter((b) => b.type === 'thinking')
    .map((b) => b.thinking ?? '')
    .join('')

  return {
    content: text,
    reasoningTrace: thinking || undefined,
    usage: json.usage
      ? { inputTokens: json.usage.input_tokens, outputTokens: json.usage.output_tokens }
      : undefined,
  }
}

async function* streamMessage(
  request: ChatRequest,
  credentials: ProviderCredentials
): AsyncIterable<ChatChunk> {
  let res: Response
  try {
    res = await fetch(`${resolveBaseUrl(credentials)}/messages`, {
      method: 'POST',
      headers: buildHeaders(credentials),
      body: JSON.stringify(buildBody(request, true)),
      signal: request.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ProviderError({
      code: 'network_error',
      message: friendlyMessage('network_error'),
      providerId: 'anthropic',
      retryable: true,
    })
  }

  if (!res.ok) await throwNormalizedError(res)
  if (!res.body) {
    throw new ProviderError({
      code: 'stream_interrupted',
      message: 'No response stream was received from the provider.',
      providerId: 'anthropic',
    })
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // Anthropic frames are "event: <type>\ndata: <json>\n\n" — a
      // fundamentally different shape from OpenAI's flat "data: <json>\n\n",
      // which is exactly what this milestone is meant to prove the
      // architecture can absorb without touching anything above this file.
      const frames = buffer.split('\n\n')
      buffer = frames.pop() ?? ''

      for (const frame of frames) {
        let eventType = ''
        let dataLine = ''
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) eventType = line.slice(6).trim()
          else if (line.startsWith('data:')) dataLine = line.slice(5).trim()
        }
        if (!dataLine) continue

        let payload: Record<string, unknown>
        try {
          payload = JSON.parse(dataLine) as Record<string, unknown>
        } catch {
          continue
        }

        if (eventType === 'content_block_delta') {
          const delta = payload.delta as
            { type?: string; text?: string; thinking?: string } | undefined
          if (delta?.type === 'text_delta' && delta.text) {
            yield { type: 'text', textDelta: delta.text }
          } else if (delta?.type === 'thinking_delta' && delta.thinking) {
            yield { type: 'reasoning', reasoningDelta: delta.thinking }
          }
        } else if (eventType === 'error') {
          const code = classifyAnthropicError(200, payload as AnthropicErrorBody)
          throw new ProviderError({ code, message: friendlyMessage(code), providerId: 'anthropic' })
        } else if (eventType === 'message_stop') {
          yield { type: 'done' }
          return
        }
        // message_start / content_block_start / content_block_stop /
        // message_delta / ping carry no text content we need for this
        // milestone — intentionally ignored, same as OpenAI's keep-alives.
      }
    }
    yield { type: 'done' }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return
    if (err instanceof ProviderError) throw err
    throw new ProviderError({
      code: 'stream_interrupted',
      message: friendlyMessage('stream_interrupted'),
      providerId: 'anthropic',
    })
  } finally {
    reader.releaseLock()
  }
}

const anthropicCapabilities = {
  ...DEFAULT_CAPABILITIES,
  streaming: true,
  vision: true,
  reasoning: true,
}
const anthropicLimits = deriveLimitsFromCapabilities(anthropicCapabilities, {
  maxOutputTokens: DEFAULT_MAX_TOKENS,
})

export const anthropicProvider: ChatProvider = {
  meta: {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models directly from Anthropic. Optional proxy avoids exposing your key.',
    docsUrl: 'https://docs.anthropic.com',
    isLocal: false,
    requiresKey: true,
    credentialFields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'apiKey',
        placeholder: 'sk-ant-...',
        helpUrl: 'https://console.anthropic.com/settings/keys',
      },
      {
        key: 'proxyUrl',
        label: 'Proxy URL (optional)',
        type: 'baseUrl',
        placeholder: 'https://your-proxy.example.com',
      },
    ],
    capabilities: anthropicCapabilities,
    limits: anthropicLimits,
  },
  validateKey,
  listModels,
  sendMessage,
  streamMessage,
  estimateCost: createEstimateCost(),
  estimateContext: createEstimateContext(anthropicLimits),
  supportsCapability: createSupportsCapability(anthropicCapabilities),
}
