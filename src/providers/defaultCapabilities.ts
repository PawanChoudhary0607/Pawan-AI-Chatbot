import type { ProviderCapabilities } from '@/types/provider'

/** Baseline: nothing declared until an adapter explicitly turns it on. Kept
 * in one place so every adapter's "conservative by default" stance is
 * defined once, not copy-pasted per adapter. */
export const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  vision: false,
  documentInput: false,
  toolCalling: false,
  structuredOutput: false,
  reasoning: false,
  webSearch: false,
  mcp: false,
  embeddings: false,
  imageGeneration: false,
}
