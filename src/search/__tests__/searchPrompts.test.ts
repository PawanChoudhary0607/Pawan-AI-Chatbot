import { describe, expect, it } from 'vitest'
import { searchPrompts } from '@/search/searchPrompts'
import type { SavedPrompt } from '@/types/prompt'

function makePrompt(overrides: Partial<SavedPrompt> = {}): SavedPrompt {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    title: 'Untitled prompt',
    content: 'Some content',
    favorite: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('searchPrompts', () => {
  it('returns every prompt for an empty query (browse mode)', () => {
    const prompts = [makePrompt(), makePrompt()]
    expect(searchPrompts(prompts, '')).toHaveLength(2)
  })

  it('matches by title', () => {
    const prompts = [makePrompt({ title: 'Code review' }), makePrompt({ title: 'Blog outline' })]
    expect(searchPrompts(prompts, 'code')).toEqual([
      expect.objectContaining({ title: 'Code review' }),
    ])
  })

  it('matches by content', () => {
    const prompts = [makePrompt({ content: 'Summarize this document concisely' })]
    expect(searchPrompts(prompts, 'summarize')).toHaveLength(1)
  })

  it('matches by category', () => {
    const prompts = [
      makePrompt({ title: 'A', category: 'Writing' }),
      makePrompt({ title: 'B', category: 'Coding' }),
    ]
    expect(searchPrompts(prompts, 'writing')).toEqual([expect.objectContaining({ title: 'A' })])
  })

  it('returns an empty array when nothing matches', () => {
    const prompts = [makePrompt({ title: 'A' })]
    expect(searchPrompts(prompts, 'zzz')).toEqual([])
  })
})
