import { describe, expect, it } from 'vitest'
import {
  createEstimateContext,
  createEstimateCost,
  createSupportsCapability,
  estimateRequestTokens,
} from '@/providers/runtimeCapabilities'
import type { ChatRequest, ProviderCapabilities } from '@/types/provider'

function makeRequest(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    model: 'test-model',
    messages: [
      { id: 'm1', role: 'user', content: 'Hello', status: 'complete', createdAt: Date.now() },
    ],
    ...overrides,
  }
}

describe('estimateRequestTokens', () => {
  it('returns 0 for an empty request', () => {
    expect(estimateRequestTokens(makeRequest({ messages: [] }))).toBe(0)
  })

  it('scales roughly with message content length (character-count heuristic)', () => {
    const short = estimateRequestTokens(makeRequest({ messages: [msg('Hi')] }))
    const long = estimateRequestTokens(makeRequest({ messages: [msg('Hi'.repeat(100))] }))
    expect(long).toBeGreaterThan(short)
  })

  it('includes the system prompt in the estimate', () => {
    const withoutSystem = estimateRequestTokens(makeRequest())
    const withSystem = estimateRequestTokens(
      makeRequest({ systemPrompt: 'You are a helpful assistant with a long system prompt.' })
    )
    expect(withSystem).toBeGreaterThan(withoutSystem)
  })

  it('adds a flat overhead per attachment, regardless of attachment kind', () => {
    const base = estimateRequestTokens(makeRequest())
    const withAttachment = estimateRequestTokens(
      makeRequest({
        messages: [
          {
            ...msg('Hello'),
            attachments: [
              {
                id: 'a1',
                kind: 'image',
                name: 'a.png',
                mimeType: 'image/png',
                data: 'x',
                sizeBytes: 1,
              },
            ],
          },
        ],
      })
    )
    expect(withAttachment).toBeGreaterThan(base)
  })

  function msg(content: string) {
    return {
      id: 'm',
      role: 'user' as const,
      content,
      status: 'complete' as const,
      createdAt: Date.now(),
    }
  }
})

describe('createEstimateCost', () => {
  const estimateCost = createEstimateCost()

  it('always marks the result as an estimate, never authoritative', () => {
    expect(estimateCost(makeRequest()).isEstimate).toBe(true)
  })

  it('uses request.maxTokens as the output-token estimate when provided', () => {
    const result = estimateCost(makeRequest({ maxTokens: 500 }))
    expect(result.outputTokens).toBe(500)
  })

  it('falls back to a default output-token estimate when maxTokens is not set', () => {
    const result = estimateCost(makeRequest())
    expect(result.outputTokens).toBeGreaterThan(0)
  })

  it('inputTokens matches estimateRequestTokens for the same request', () => {
    const request = makeRequest()
    expect(estimateCost(request).inputTokens).toBe(estimateRequestTokens(request))
  })
})

describe('createEstimateContext', () => {
  it('uses the model contextWindow over the provider-level limit when both are supplied', () => {
    const estimateContext = createEstimateContext({ maxContextTokens: 1000 })
    const result = estimateContext(makeRequest(), { id: 'm', name: 'M', contextWindow: 200000 })
    expect(result.maxTokens).toBe(200000)
  })

  it('falls back to the provider-level maxContextTokens when no model is supplied', () => {
    const estimateContext = createEstimateContext({ maxContextTokens: 1000 })
    const result = estimateContext(makeRequest())
    expect(result.maxTokens).toBe(1000)
  })

  it('leaves maxTokens/remainingTokens undefined when neither source provides a ceiling', () => {
    const estimateContext = createEstimateContext(undefined)
    const result = estimateContext(makeRequest())
    expect(result.maxTokens).toBeUndefined()
    expect(result.remainingTokens).toBeUndefined()
  })

  it('computes remainingTokens as maxTokens - usedTokens, floored at 0', () => {
    const estimateContext = createEstimateContext({ maxContextTokens: 10 })
    const result = estimateContext(makeRequest({ messages: [] }), undefined)
    // usedTokens is 0 for an empty message list (no system prompt either)
    expect(result.usedTokens).toBe(0)
    expect(result.remainingTokens).toBe(10)
  })

  it('never returns a negative remainingTokens even if usedTokens exceeds the ceiling', () => {
    const estimateContext = createEstimateContext({ maxContextTokens: 1 })
    const result = estimateContext(
      makeRequest({
        messages: [
          {
            id: 'm',
            role: 'user',
            content: 'x'.repeat(1000),
            status: 'complete',
            createdAt: Date.now(),
          },
        ],
      })
    )
    expect(result.remainingTokens).toBe(0)
  })

  it('always marks the result as an estimate', () => {
    const estimateContext = createEstimateContext(undefined)
    expect(estimateContext(makeRequest()).isEstimate).toBe(true)
  })
})

describe('createSupportsCapability', () => {
  const capabilities: ProviderCapabilities = {
    streaming: true,
    vision: true,
    documentInput: false,
    toolCalling: false,
    structuredOutput: false,
    reasoning: false,
    webSearch: false,
    mcp: false,
    embeddings: false,
    imageGeneration: false,
  }
  const supportsCapability = createSupportsCapability(capabilities)

  it('returns true for capabilities the provider declares true', () => {
    expect(supportsCapability('streaming')).toBe(true)
    expect(supportsCapability('vision')).toBe(true)
  })

  it('returns false for capabilities the provider declares false', () => {
    expect(supportsCapability('toolCalling')).toBe(false)
    expect(supportsCapability('mcp')).toBe(false)
    expect(supportsCapability('reasoning')).toBe(false)
  })
})
