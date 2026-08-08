import { createOpenAICompatibleProvider } from '@/providers/openaiCompatible'
import type { ProviderCredentials } from '@/types/provider'

const DEFAULT_OLLAMA_URL = 'http://localhost:11434'

function resolveOllamaBaseUrl(credentials: ProviderCredentials): string {
  const raw = credentials.baseUrl?.trim() || DEFAULT_OLLAMA_URL
  return `${raw.replace(/\/+$/, '')}/v1`
}

/**
 * Ollama also exposes an OpenAI-compatible endpoint
 * (/v1/chat/completions, /v1/models) alongside its native API, so this
 * reuses the same factory as OpenRouter and Gemini — the only real
 * difference is the base URL is user-configurable (a local server,
 * possibly on a non-default host/port) instead of fixed, and no API key is
 * required by default.
 */
export const ollamaProvider = createOpenAICompatibleProvider({
  id: 'ollama',
  name: 'Ollama',
  description: 'Run models locally. No API key required, no data leaves this machine.',
  docsUrl: 'https://ollama.com',
  isLocal: true,
  requiresKey: false,
  credentialFields: [
    {
      key: 'baseUrl',
      label: 'Server URL',
      type: 'baseUrl',
      placeholder: DEFAULT_OLLAMA_URL,
    },
  ],
  capabilities: { streaming: true },
  baseUrl: resolveOllamaBaseUrl,
  headers: () => ({}), // no auth for a local server
  mapModel: (raw) => ({
    id: String(raw.id),
    name: String(raw.id),
  }),
})
