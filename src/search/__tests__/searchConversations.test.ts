import { describe, expect, it } from 'vitest'
import { searchConversations } from '@/search/searchConversations'
import type { Conversation } from '@/types/conversation'

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    title: 'Untitled',
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

describe('searchConversations', () => {
  it('returns no matches for an empty query', () => {
    const conversations = [makeConversation({ title: 'Trip planning' })]
    expect(searchConversations(conversations, '')).toEqual([])
  })

  it('matches by title', () => {
    const conversations = [
      makeConversation({ title: 'Trip planning' }),
      makeConversation({ title: 'Recipe ideas' }),
    ]
    const results = searchConversations(conversations, 'trip')
    expect(results).toHaveLength(1)
    expect(results[0].titleMatch).toBe(true)
  })

  it('matches by message content when the title does not match', () => {
    const conversation = makeConversation({
      title: 'Untitled',
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'Tell me about quantum computing',
          status: 'complete',
          createdAt: Date.now(),
        },
      ],
    })
    const results = searchConversations([conversation], 'quantum')
    expect(results).toHaveLength(1)
    expect(results[0].titleMatch).toBe(false)
    expect(results[0].messageSnippets[0]).toContain('quantum')
  })

  it('is case-insensitive', () => {
    const conversation = makeConversation({ title: 'Trip Planning' })
    expect(searchConversations([conversation], 'TRIP PLANNING')).toHaveLength(1)
  })

  it('returns nothing when there is no match anywhere', () => {
    const conversation = makeConversation({
      title: 'Untitled',
      messages: [
        { id: 'm1', role: 'user', content: 'Hello', status: 'complete', createdAt: Date.now() },
      ],
    })
    expect(searchConversations([conversation], 'nonexistent')).toEqual([])
  })

  it('caps the number of message snippets per conversation', () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({
      id: `m${i}`,
      role: 'user' as const,
      content: `match number ${i}`,
      status: 'complete' as const,
      createdAt: Date.now(),
    }))
    const conversation = makeConversation({ messages })
    const results = searchConversations([conversation], 'match', 2)
    expect(results[0].messageSnippets).toHaveLength(2)
  })
})
