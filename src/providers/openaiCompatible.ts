import { ProviderError, classifyHttpStatus, friendlyMessage } from '@/providers/errors'
import { DEFAULT_CAPABILITIES } from '@/providers/defaultCapabilities'
import { deriveLimitsFromCapabilities } from '@/providers/deriveLimits'
import {
  createEstimateContext,
  createEstimateCost,
  createSupportsCapability,
} from '@/providers/runtimeCapabilities'
import type {
  ChatChunk,
  ChatProvider,
  ChatRequest,
  ChatResponse,
  CredentialField,
  ModelInfo,
  ProviderCapabilities,
  ProviderCredentials,
  ProviderLimits,
  ProviderMeta,
  ValidationResult,
} from '@/types/provider'

export interface OpenAICompatibleConfig {
  id: string
  name: string
  description?: string
  docsUrl?: string
  /** Either a fixed base URL (OpenRouter, Gemini) or a function that
   * resolves one from the user's stored credentials (Ollama and other local
   * servers, where the host/port is user-configurable). */
  baseUrl: string | ((credentials: ProviderCredentials) => string)
  isLocal?: boolean
  requiresKey?: boolean
  credentialFields?: CredentialField[]
  capabilities?: Partial<ProviderCapabilities>
  limits?: ProviderLimits
  /** Extra headers beyond the always-included Content-Type, built from the
   * user's stored credentials (e.g. Authorization: Bearer <key>). */
  headers?: (credentials: ProviderCredentials) => Record<string, string>
  modelsPath?: string
  chatPath?: string
  /** Maps one raw entry from the provider's /models response into our
   * normalized ModelInfo. Defaults to a reasonable OpenAI-shape guess. */
  mapModel?: (raw: Record<string, unknown>) => ModelInfo
}

interface OpenAIStreamDelta {
  choices?: Array<{ delta?: { content?: string } }>
}

interface OpenAICompletion {
  choices?: Array<{ message?: { content?: string } }>
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

function defaultMapModel(raw: Record<string, unknown>): ModelInfo {
  const id = String(raw.id ?? raw.name ?? 'unknown-model')
  return {
    id,
    name: typeof raw.name === 'string' ? raw.name : id,
    contextWindow:
      typeof raw.context_length === 'number'
        ? raw.context_length
        : typeof raw.context_window === 'number'
          ? raw.context_window
          : undefined,
  }
}

/**
 * Creates a ChatProvider for any API that speaks the OpenAI chat-completions
 * shape (`/models`, `/chat/completions`, SSE `data: {...}` streaming). This
 * is the one adapter implementation OpenRouter, and later DeepSeek, Groq,
 * xAI, Together AI, LM Studio, and generic local OpenAI-compatible servers,
 * all reuse — per the approved provider architecture, adding one of those
 * later is a config object, not a new adapter.
 */
export function createOpenAICompatibleProvider(config: OpenAICompatibleConfig): ChatProvider {
  const capabilities: ProviderCapabilities = { ...DEFAULT_CAPABILITIES, ...config.capabilities }
  const meta: ProviderMeta = {
    id: config.id,
    name: config.name,
    description: config.description,
    docsUrl: config.docsUrl,
    isLocal: config.isLocal ?? false,
    requiresKey: config.requiresKey ?? true,
    credentialFields: config.credentialFields ?? [
      { key: 'apiKey', label: 'API Key', type: 'apiKey' },
    ],
    capabilities,
    limits: deriveLimitsFromCapabilities(capabilities, config.limits),
  }

  const modelsPath = config.modelsPath ?? '/models'
  const chatPath = config.chatPath ?? '/chat/completions'

  function resolveBaseUrl(credentials: ProviderCredentials): string {
    return typeof config.baseUrl === 'function' ? config.baseUrl(credentials) : config.baseUrl
  }

  function buildHeaders(credentials: ProviderCredentials): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(config.headers ? config.headers(credentials) : {}),
    }
  }

  async function throwNormalizedError(response: Response): Promise<never> {
    const code = classifyHttpStatus(response.status)
    throw new ProviderError({
      code,
      message: friendlyMessage(code),
      providerId: config.id,
      retryable: code === 'rate_limited' || code === 'network_error',
    })
  }

  async function validateKey(credentials: ProviderCredentials): Promise<ValidationResult> {
    try {
      const res = await fetch(`${resolveBaseUrl(credentials)}${modelsPath}`, {
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
    const res = await fetch(`${resolveBaseUrl(credentials)}${modelsPath}`, {
      headers: buildHeaders(credentials),
    })
    if (!res.ok) await throwNormalizedError(res)
    const json = (await res.json()) as { data?: unknown[] } | unknown[]
    const rawList = Array.isArray(json) ? json : Array.isArray(json.data) ? json.data : []
    return (rawList as Record<string, unknown>[]).map((raw) =>
      config.mapModel ? config.mapModel(raw) : defaultMapModel(raw)
    )
  }

  function buildBody(request: ChatRequest, stream: boolean) {
    return {
      model: request.model,
      stream,
      temperature: request.temperature,
      top_p: request.topP,
      max_tokens: request.maxTokens,
      messages: [
        ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
        ...request.messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ role: m.role, content: m.content })),
      ],
    }
  }

  async function sendMessage(
    request: ChatRequest,
    credentials: ProviderCredentials
  ): Promise<ChatResponse> {
    const res = await fetch(`${resolveBaseUrl(credentials)}${chatPath}`, {
      method: 'POST',
      headers: buildHeaders(credentials),
      body: JSON.stringify(buildBody(request, false)),
      signal: request.signal,
    })
    if (!res.ok) await throwNormalizedError(res)
    const json = (await res.json()) as OpenAICompletion
    return {
      content: json.choices?.[0]?.message?.content ?? '',
      usage: json.usage
        ? { inputTokens: json.usage.prompt_tokens, outputTokens: json.usage.completion_tokens }
        : undefined,
    }
  }

  async function* streamMessage(
    request: ChatRequest,
    credentials: ProviderCredentials
  ): AsyncIterable<ChatChunk> {
    let res: Response
    try {
      res = await fetch(`${resolveBaseUrl(credentials)}${chatPath}`, {
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
        providerId: config.id,
        retryable: true,
      })
    }

    if (!res.ok) await throwNormalizedError(res)
    if (!res.body) {
      throw new ProviderError({
        code: 'stream_interrupted',
        message: 'No response stream was received from the provider.',
        providerId: config.id,
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

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const rawLine of lines) {
          const line = rawLine.trim()
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          if (payload === '[DONE]') {
            yield { type: 'done' }
            return
          }
          if (!payload) continue
          try {
            const json = JSON.parse(payload) as OpenAIStreamDelta
            const delta = json.choices?.[0]?.delta?.content
            if (delta) {
              yield { type: 'text', textDelta: delta }
            }
          } catch {
            // Some providers send non-JSON keep-alive comments; ignore.
          }
        }
      }
      yield { type: 'done' }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // A user-initiated stop is not an error — the caller distinguishes
        // this case via the AbortSignal it passed in.
        return
      }
      throw new ProviderError({
        code: 'stream_interrupted',
        message: friendlyMessage('stream_interrupted'),
        providerId: config.id,
      })
    } finally {
      reader.releaseLock()
    }
  }

  return {
    meta,
    validateKey,
    listModels,
    sendMessage,
    streamMessage,
    estimateCost: createEstimateCost(),
    estimateContext: createEstimateContext(meta.limits),
    supportsCapability: createSupportsCapability(capabilities),
  }
}
