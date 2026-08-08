import { describe, expect, it } from 'vitest'
import { computeConversationStatistics } from '@/conversations/statistics'
import type { Conversation } from '@/types/conversation'

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  const now = Date.now()
  return {
    id: 'conv-1',
    title: 'Test',
    providerId: 'openrouter',
    model: 'test-model',
    temperature: 0.7,
    topP: 1,
    pinned: false,
    archived: false,
    lastOpenedAt: now,
    messages: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('computeConversationStatistics', () => {
  it('counts messages by role', () => {
    const conversation = makeConversation({
      messages: [
        { id: 'm1', role: 'user', content: 'hi', status: 'complete', createdAt: Date.now() },
        {
          id: 'm2',
          role: 'assistant',
          content: 'hello',
          status: 'complete',
          createdAt: Date.now(),
        },
        { id: 'm3', role: 'user', content: 'thanks', status: 'complete', createdAt: Date.now() },
      ],
    })
    const stats = computeConversationStatistics(conversation)
    expect(stats.totalMessages).toBe(3)
    expect(stats.userMessages).toBe(2)
    expect(stats.assistantMessages).toBe(1)
  })

  it('sums total characters across all messages', () => {
    const conversation = makeConversation({
      messages: [
        { id: 'm1', role: 'user', content: 'abc', status: 'complete', createdAt: Date.now() },
        { id: 'm2', role: 'assistant', content: 'de', status: 'complete', createdAt: Date.now() },
      ],
    })
    expect(computeConversationStatistics(conversation).totalCharacters).toBe(5)
  })

  it('counts attachments across all messages', () => {
    const conversation = makeConversation({
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'x',
          status: 'complete',
          createdAt: Date.now(),
          attachments: [
            {
              id: 'a1',
              kind: 'image',
              name: 'a.png',
              mimeType: 'image/png',
              data: 'x',
              sizeBytes: 1,
            },
            {
              id: 'a2',
              kind: 'document',
              name: 'b.pdf',
              mimeType: 'application/pdf',
              data: 'y',
              sizeBytes: 1,
            },
          ],
        },
      ],
    })
    expect(computeConversationStatistics(conversation).attachmentCount).toBe(2)
  })

  it('estimates tokens using the shared runtime heuristic (greater than zero for non-empty content)', () => {
    const conversation = makeConversation({
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'Hello world',
          status: 'complete',
          createdAt: Date.now(),
        },
      ],
    })
    expect(computeConversationStatistics(conversation).estimatedTokens).toBeGreaterThan(0)
  })

  it('reports zero for an empty conversation', () => {
    const stats = computeConversationStatistics(makeConversation({ messages: [] }))
    expect(stats.totalMessages).toBe(0)
    expect(stats.totalCharacters).toBe(0)
    expect(stats.estimatedTokens).toBe(0)
    expect(stats.attachmentCount).toBe(0)
  })

  it('carries through provider, model, and timestamps', () => {
    const conversation = makeConversation({ providerId: 'anthropic', model: 'claude-sonnet-4-5' })
    const stats = computeConversationStatistics(conversation)
    expect(stats.providerId).toBe('anthropic')
    expect(stats.model).toBe('claude-sonnet-4-5')
    expect(stats.createdAt).toBe(conversation.createdAt)
    expect(stats.updatedAt).toBe(conversation.updatedAt)
  })
})
