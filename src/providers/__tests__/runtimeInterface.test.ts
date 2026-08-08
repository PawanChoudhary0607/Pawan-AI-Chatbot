import { describe, expect, it } from 'vitest'
import { openRouterProvider } from '@/providers/openrouter'
import { geminiProvider } from '@/providers/gemini'
import { ollamaProvider } from '@/providers/ollama'
import { anthropicProvider } from '@/providers/anthropic'
import type { ChatProvider, ChatRequest } from '@/types/provider'

function makeRequest(): ChatRequest {
  return {
    model: 'test-model',
    messages: [
      { id: 'm1', role: 'user', content: 'Hello there', status: 'complete', createdAt: Date.now() },
    ],
  }
}

const PROVIDERS: Array<{ name: string; provider: ChatProvider }> = [
  { name: 'OpenRouter', provider: openRouterProvider },
  { name: 'Gemini', provider: geminiProvider },
  { name: 'Ollama', provider: ollamaProvider },
  { name: 'Anthropic', provider: anthropicProvider },
]

describe.each(PROVIDERS)('runtime interface: $name', ({ provider }) => {
  it('exposes estimateCost, estimateContext, and supportsCapability', () => {
    expect(typeof provider.estimateCost).toBe('function')
    expect(typeof provider.estimateContext).toBe('function')
    expect(typeof provider.supportsCapability).toBe('function')
  })

  it('estimateCost returns a shape marked as an estimate, never authoritative', () => {
    const result = provider.estimateCost(makeRequest())
    expect(result.isEstimate).toBe(true)
    expect(result.inputTokens).toBeGreaterThan(0)
  })

  it('estimateContext returns a shape marked as an estimate', () => {
    const result = provider.estimateContext(makeRequest())
    expect(result.isEstimate).toBe(true)
    expect(result.usedTokens).toBeGreaterThan(0)
  })

  it('supportsCapability("streaming") is true for every registered provider', () => {
    // Every provider in this app declares streaming — the one capability
    // actually exercised by the chat pipeline this far.
    expect(provider.supportsCapability('streaming')).toBe(true)
  })

  it('supportsCapability agrees exactly with meta.capabilities for every flag', () => {
    const flags = Object.keys(provider.meta.capabilities) as Array<
      keyof typeof provider.meta.capabilities
    >
    for (const flag of flags) {
      expect(provider.supportsCapability(flag)).toBe(provider.meta.capabilities[flag])
    }
  })

  it('meta.limits capability mirrors agree with meta.capabilities (single source of truth)', () => {
    expect(provider.meta.limits?.supportsStreaming).toBe(provider.meta.capabilities.streaming)
    expect(provider.meta.limits?.supportsVision).toBe(provider.meta.capabilities.vision)
    expect(provider.meta.limits?.supportsReasoning).toBe(provider.meta.capabilities.reasoning)
    expect(provider.meta.limits?.supportsToolCalling).toBe(provider.meta.capabilities.toolCalling)
    expect(provider.meta.limits?.supportsMCP).toBe(provider.meta.capabilities.mcp)
  })
})

describe('capability differentiation across providers (proves no hidden hardcoding)', () => {
  it('only Anthropic declares vision and reasoning true among the four registered providers', () => {
    expect(anthropicProvider.supportsCapability('vision')).toBe(true)
    expect(anthropicProvider.supportsCapability('reasoning')).toBe(true)
    expect(openRouterProvider.supportsCapability('vision')).toBe(false)
    expect(geminiProvider.supportsCapability('vision')).toBe(false)
    expect(ollamaProvider.supportsCapability('vision')).toBe(false)
  })
})
