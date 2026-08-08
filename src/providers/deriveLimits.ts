import type { ProviderCapabilities, ProviderLimits } from '@/types/provider'

/**
 * Builds a provider's `limits` object with the capability-mirror booleans
 * always derived from `capabilities` — never hand-set — so they can't drift
 * out of sync. `overrides` supplies the genuinely provider-specific numeric
 * limits (maxContextTokens, maxAttachments, etc); those are the only part
 * of the returned object an adapter should be passing anything meaningful
 * for.
 */
export function deriveLimitsFromCapabilities(
  capabilities: ProviderCapabilities,
  overrides: ProviderLimits = {}
): ProviderLimits {
  return {
    ...overrides,
    supportsStreaming: capabilities.streaming,
    supportsVision: capabilities.vision,
    supportsReasoning: capabilities.reasoning,
    supportsJSON: capabilities.structuredOutput,
    supportsToolCalling: capabilities.toolCalling,
    supportsMCP: capabilities.mcp,
  }
}
