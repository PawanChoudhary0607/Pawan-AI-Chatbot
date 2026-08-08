import { createOpenAICompatibleProvider } from '@/providers/openaiCompatible'

export const openRouterProvider = createOpenAICompatibleProvider({
  id: 'openrouter',
  name: 'OpenRouter',
  description: 'One API key, access to hundreds of hosted models from many labs.',
  docsUrl: 'https://openrouter.ai/docs',
  baseUrl: 'https://openrouter.ai/api/v1',
  requiresKey: true,
  credentialFields: [
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'apiKey',
      placeholder: 'sk-or-v1-...',
      helpUrl: 'https://openrouter.ai/keys',
    },
  ],
  // Conservative on purpose: OpenRouter's underlying models vary widely in
  // what they support (some are vision/tool-capable, most aren't), and this
  // milestone doesn't implement per-model capability overrides or the
  // upload/tool UI those would drive. Streaming is the only capability this
  // milestone actually exercises end-to-end, so it's the only one declared
  // true at the provider level for now — see Milestone 3 recommendations.
  capabilities: { streaming: true },
  headers: (credentials) => ({
    Authorization: `Bearer ${credentials.apiKey ?? ''}`,
    // Optional but recommended by OpenRouter for attribution/rate-limit
    // pooling; harmless to omit if unset.
    'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
    'X-Title': 'Pawan AI Chatbot',
  }),
  mapModel: (raw) => ({
    id: String(raw.id),
    name: typeof raw.name === 'string' ? raw.name : String(raw.id),
    contextWindow: typeof raw.context_length === 'number' ? raw.context_length : undefined,
  }),
})
