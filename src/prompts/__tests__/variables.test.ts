import { describe, expect, it } from 'vitest'
import { extractVariables, isTemplate, renderTemplate } from '@/prompts/variables'

describe('extractVariables', () => {
  it('extracts a single variable', () => {
    expect(extractVariables('Summarize {{text}}')).toEqual(['text'])
  })

  it('extracts multiple variables in order of first appearance', () => {
    expect(extractVariables('{{greeting}}, {{name}}! Today is {{day}}.')).toEqual([
      'greeting',
      'name',
      'day',
    ])
  })

  it('deduplicates repeated variables', () => {
    expect(extractVariables('{{name}} and {{name}} again')).toEqual(['name'])
  })

  it('returns an empty array for plain prompts with no variables', () => {
    expect(extractVariables('Just a plain prompt with no placeholders.')).toEqual([])
  })

  it('tolerates extra whitespace inside the braces', () => {
    expect(extractVariables('{{  spaced  }}')).toEqual(['spaced'])
  })

  it('ignores malformed braces (single brace, unclosed)', () => {
    expect(extractVariables('{not a variable} and {{unclosed')).toEqual([])
  })
})

describe('isTemplate', () => {
  it('is true when the content has at least one variable', () => {
    expect(isTemplate('Hello {{name}}')).toBe(true)
  })

  it('is false for plain content', () => {
    expect(isTemplate('Hello there')).toBe(false)
  })
})

describe('renderTemplate', () => {
  it('substitutes a single variable', () => {
    expect(renderTemplate('Summarize {{text}}', { text: 'this article' })).toBe(
      'Summarize this article'
    )
  })

  it('substitutes multiple variables', () => {
    expect(renderTemplate('{{greeting}}, {{name}}!', { greeting: 'Hi', name: 'Ada' })).toBe(
      'Hi, Ada!'
    )
  })

  it('leaves a variable with no supplied value untouched, rather than blanking it', () => {
    expect(renderTemplate('{{a}} and {{b}}', { a: 'filled' })).toBe('filled and {{b}}')
  })

  it('leaves a variable supplied as an empty string untouched too', () => {
    expect(renderTemplate('{{a}}', { a: '' })).toBe('{{a}}')
  })

  it('is a no-op on content with no variables', () => {
    expect(renderTemplate('Plain content', {})).toBe('Plain content')
  })

  it('substitutes repeated occurrences of the same variable', () => {
    expect(renderTemplate('{{x}} + {{x}} = 2{{x}}', { x: '5' })).toBe('5 + 5 = 25')
  })
})
