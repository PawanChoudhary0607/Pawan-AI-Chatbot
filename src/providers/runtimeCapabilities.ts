import type {
  ChatRequest,
  ContextEstimate,
  CostEstimate,
  ModelInfo,
  ProviderCapabilities,
  ProviderLimits,
} from '@/types/provider'

/** Rough heuristic: ~4 characters per token. No real tokenizer is wired up
 * for any provider yet, so every adapter uses this same approximation
 * rather than each inventing a slightly different one. */
const CHARS_PER_TOKEN_ESTIMATE = 4
/** Flat per-attachment token overhead, since we can't generically tokenize
 * image/document content without a provider-specific vision tokenizer. */
const ATTACHMENT_TOKEN_OVERHEAD = 256
/** Used as the output-token estimate when a request doesn't specify
 * maxTokens — deliberately conservative/round, not tied to any provider's
 * real default. */
const DEFAULT_OUTPUT_TOKEN_ESTIMATE = 1024

function estimateTokensFromText(text: string | undefined): number {
  if (!text) return 0
  return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE)
}

/** Sums a heuristic token estimate across a request's system prompt,
 * message contents, and a flat overhead per attachment. Exported on its
 * own since both estimateCost and estimateContext need the same number. */
export function estimateRequestTokens(request: ChatRequest): number {
  let total = estimateTokensFromText(request.systemPrompt)
  for (const message of request.messages) {
    total += estimateTokensFromText(message.content)
    total += (message.attachments?.length ?? 0) * ATTACHMENT_TOKEN_OVERHEAD
  }
  return total
}

/** Returns a bound estimateContext function closed over a provider's
 * limits, so `model?.contextWindow` (when supplied) can take priority over
 * the provider-level `maxContextTokens` ceiling per call. */
export function createEstimateContext(limits: ProviderLimits | undefined) {
  return function estimateContext(request: ChatRequest, model?: ModelInfo): ContextEstimate {
    const usedTokens = estimateRequestTokens(request)
    const maxTokens = model?.contextWindow ?? limits?.maxContextTokens
    return {
      usedTokens,
      maxTokens,
      remainingTokens: maxTokens !== undefined ? Math.max(maxTokens - usedTokens, 0) : undefined,
      isEstimate: true,
    }
  }
}

export function createEstimateCost() {
  return function estimateCost(request: ChatRequest): CostEstimate {
    return {
      inputTokens: estimateRequestTokens(request),
      outputTokens: request.maxTokens ?? DEFAULT_OUTPUT_TOKEN_ESTIMATE,
      isEstimate: true,
    }
  }
}

export function createSupportsCapability(capabilities: ProviderCapabilities) {
  return function supportsCapability(capability: keyof ProviderCapabilities): boolean {
    return Boolean(capabilities[capability])
  }
}
