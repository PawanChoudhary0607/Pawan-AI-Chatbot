import { createOpenAICompatibleProvider } from '@/providers/openaiCompatible'

/**
 * Google publishes an OpenAI-compatible endpoint for the Gemini API
 * (https://ai.google.dev/gemini-api/docs/openai) that speaks the same
 * /chat/completions + /models + SSE-streaming shape as OpenAI/OpenRouter.
 * That means Gemini needs zero bespoke adapter code — it's a config object
 * for the same factory OpenRouter uses, exactly as the approved provider
 * architecture intended.
 */
export const geminiProvider = createOpenAICompatibleProvider({
  id: 'gemini',
  name: 'Google Gemini',
  description: "Google's Gemini models, via their OpenAI-compatible endpoint.",
  docsUrl: 'https://ai.google.dev/gemini-api/docs/openai',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
  requiresKey: true,
  credentialFields: [
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'apiKey',
      placeholder: 'AIza...',
      helpUrl: 'https://aistudio.google.com/apikey',
    },
  ],
  // Same conservative stance as OpenRouter: only streaming is declared true
  // this milestone. Gemini genuinely supports vision/tools/structured
  // output on top of this same OpenAI-compatible endpoint, but nothing in
  // the app builds those UIs yet, so capability flags stay honest about
  // what's actually wired up.
  capabilities: { streaming: true },
  headers: (credentials) => ({
    Authorization: `Bearer ${credentials.apiKey ?? ''}`,
  }),
  mapModel: (raw) => ({
    id: String(raw.id),
    name: typeof raw.name === 'string' ? raw.name : String(raw.id),
  }),
})
