import { describe, expect, it } from 'vitest'
import { searchArtifacts } from '@/search/searchArtifacts'
import type { Conversation } from '@/types/conversation'

function makeConversation(id: string, content: string): Conversation {
  const now = Date.now()
  return {
    id,
    title: `Conversation ${id}`,
    providerId: 'openrouter',
    model: 'test-model',
    temperature: 0.7,
    topP: 1,
    pinned: false,
    archived: false,
    lastOpenedAt: now,
    messages: [{ id: `${id}-m1`, role: 'assistant', content, status: 'complete', createdAt: now }],
    createdAt: now,
    updatedAt: now,
  }
}

describe('searchArtifacts', () => {
  it('returns no matches for an empty query', () => {
    const conversations = [makeConversation('c1', '```js\nconsole.log(1)\n```')]
    expect(searchArtifacts(conversations, '')).toEqual([])
  })

  it('matches artifact content across multiple conversations', () => {
    const conversations = [
      makeConversation('c1', '```python\nprint("findme")\n```'),
      makeConversation('c2', '```js\nconsole.log("other")\n```'),
    ]
    const results = searchArtifacts(conversations, 'findme')
    expect(results).toHaveLength(1)
    expect(results[0].conversationId).toBe('c1')
  })

  it('matches by artifact title', () => {
    const conversations = [makeConversation('c1', '```json\n{"a":1}\n```')]
    const results = searchArtifacts(conversations, 'JSON 1')
    expect(results).toHaveLength(1)
  })

  it('returns an empty array when no conversation contains a matching artifact', () => {
    const conversations = [makeConversation('c1', '```js\nconsole.log(1)\n```')]
    expect(searchArtifacts(conversations, 'nonexistent')).toEqual([])
  })
})
