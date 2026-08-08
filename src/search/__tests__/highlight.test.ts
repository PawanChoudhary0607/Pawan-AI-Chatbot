import { describe, expect, it } from 'vitest'
import { extractSnippet, highlightMatches, textMatches } from '@/search/highlight'

describe('highlightMatches', () => {
  it('returns the whole text as non-matching when the query is empty', () => {
    expect(highlightMatches('Hello world', '')).toEqual([{ text: 'Hello world', match: false }])
  })

  it('returns the whole text as non-matching when there is no match', () => {
    expect(highlightMatches('Hello world', 'xyz')).toEqual([{ text: 'Hello world', match: false }])
  })

  it('splits a single match into before/match/after segments', () => {
    expect(highlightMatches('Hello world', 'world')).toEqual([
      { text: 'Hello ', match: false },
      { text: 'world', match: true },
    ])
  })

  it('is case-insensitive but preserves original casing in the output', () => {
    expect(highlightMatches('Hello World', 'world')).toEqual([
      { text: 'Hello ', match: false },
      { text: 'World', match: true },
    ])
  })

  it('highlights multiple occurrences of the same query', () => {
    expect(highlightMatches('cat bat cat', 'cat')).toEqual([
      { text: 'cat', match: true },
      { text: ' bat ', match: false },
      { text: 'cat', match: true },
    ])
  })

  it('matches a query at the very start or end with no adjacent segment', () => {
    expect(highlightMatches('catnip', 'cat')).toEqual([
      { text: 'cat', match: true },
      { text: 'nip', match: false },
    ])
  })
})

describe('textMatches', () => {
  it('is true for a case-insensitive substring match', () => {
    expect(textMatches('Hello World', 'world')).toBe(true)
  })

  it('is false when there is no match', () => {
    expect(textMatches('Hello World', 'xyz')).toBe(false)
  })

  it('is false for an empty query (never "matches everything")', () => {
    expect(textMatches('Hello World', '')).toBe(false)
  })
})

describe('extractSnippet', () => {
  it('centers a snippet around the match with ellipses on both sides', () => {
    const text = 'a'.repeat(60) + 'NEEDLE' + 'b'.repeat(60)
    const snippet = extractSnippet(text, 'NEEDLE', 10)
    expect(snippet).toContain('NEEDLE')
    expect(snippet.startsWith('…')).toBe(true)
    expect(snippet.endsWith('…')).toBe(true)
  })

  it('does not prepend an ellipsis when the match is near the start', () => {
    const snippet = extractSnippet('NEEDLE and then some more text here', 'NEEDLE', 10)
    expect(snippet.startsWith('…')).toBe(false)
  })
})
