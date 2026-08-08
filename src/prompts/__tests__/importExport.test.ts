import { describe, expect, it } from 'vitest'
import {
  exportPromptsAsJSON,
  exportPromptsAsMarkdown,
  parseImportedPrompts,
} from '@/prompts/importExport'
import type { SavedPrompt } from '@/types/prompt'

function makePrompt(overrides: Partial<SavedPrompt> = {}): SavedPrompt {
  const now = Date.now()
  return {
    id: 'p1',
    title: 'Code review',
    content: 'Review this code',
    favorite: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('exportPromptsAsJSON / parseImportedPrompts round-trip', () => {
  it('round-trips a prompt through export then import', () => {
    const original = [makePrompt({ category: 'Engineering', tags: ['code', 'review'] })]
    const json = exportPromptsAsJSON(original)
    const result = parseImportedPrompts(json)

    expect(result.errors).toEqual([])
    expect(result.valid).toHaveLength(1)
    expect(result.valid[0]).toMatchObject({
      title: 'Code review',
      content: 'Review this code',
      category: 'Engineering',
      tags: ['code', 'review'],
    })
  })

  it('assigns fresh ids on import rather than trusting the imported id', () => {
    const original = [makePrompt({ id: 'original-id' })]
    const result = parseImportedPrompts(exportPromptsAsJSON(original))
    expect(result.valid[0].id).not.toBe('original-id')
  })
})

describe('parseImportedPrompts', () => {
  it('rejects invalid JSON', () => {
    const result = parseImportedPrompts('{not valid json')
    expect(result.valid).toEqual([])
    expect(result.errors[0]).toMatch(/not valid json/i)
  })

  it('accepts a single prompt object, not just an array', () => {
    const result = parseImportedPrompts(JSON.stringify({ title: 'Solo', content: 'x' }))
    expect(result.valid).toHaveLength(1)
    expect(result.valid[0].title).toBe('Solo')
  })

  it('imports valid entries and reports errors for invalid ones in the same batch', () => {
    const result = parseImportedPrompts(
      JSON.stringify([
        { title: 'Good', content: 'ok' },
        { title: 'Missing content' },
        'not an object',
      ])
    )
    expect(result.valid).toHaveLength(1)
    expect(result.valid[0].title).toBe('Good')
    expect(result.errors).toHaveLength(2)
  })

  it('rejects an entry with a missing title', () => {
    const result = parseImportedPrompts(JSON.stringify([{ content: 'no title here' }]))
    expect(result.valid).toEqual([])
    expect(result.errors[0]).toMatch(/title/i)
  })

  it('imported prompts always start as not-favorite with no version history', () => {
    const result = parseImportedPrompts(
      JSON.stringify([{ title: 'X', content: 'y', favorite: true, versions: [{}] }])
    )
    expect(result.valid[0].favorite).toBe(false)
    expect(result.valid[0].versions).toBeUndefined()
  })
})

describe('exportPromptsAsMarkdown', () => {
  it('renders title, category, tags, and content', () => {
    const md = exportPromptsAsMarkdown([
      makePrompt({ title: 'Blog outline', category: 'Writing', tags: ['blog', 'outline'] }),
    ])
    expect(md).toContain('## Blog outline')
    expect(md).toContain('**Category:** Writing')
    expect(md).toContain('**Tags:** blog, outline')
    expect(md).toContain('Review this code')
  })
})
