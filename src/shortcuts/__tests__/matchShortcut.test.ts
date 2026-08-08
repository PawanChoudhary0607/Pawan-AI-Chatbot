import { describe, expect, it } from 'vitest'
import { matchesShortcut } from '@/shortcuts/matchShortcut'

function makeEvent(
  overrides: Partial<{
    key: string
    metaKey: boolean
    ctrlKey: boolean
    shiftKey: boolean
    altKey: boolean
  }> = {}
) {
  return {
    key: 'k',
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...overrides,
  }
}

describe('matchesShortcut', () => {
  it('matches "mod+k" with Cmd held (Mac)', () => {
    expect(matchesShortcut(makeEvent({ key: 'k', metaKey: true }), 'mod+k')).toBe(true)
  })

  it('matches "mod+k" with Ctrl held (Windows/Linux)', () => {
    expect(matchesShortcut(makeEvent({ key: 'k', ctrlKey: true }), 'mod+k')).toBe(true)
  })

  it('does not match "mod+k" with no modifier held', () => {
    expect(matchesShortcut(makeEvent({ key: 'k' }), 'mod+k')).toBe(false)
  })

  it('does not match a different key', () => {
    expect(matchesShortcut(makeEvent({ key: 'j', metaKey: true }), 'mod+k')).toBe(false)
  })

  it('is case-insensitive on the key', () => {
    expect(matchesShortcut(makeEvent({ key: 'K', metaKey: true }), 'mod+k')).toBe(true)
  })

  it('requires shift when the combo specifies it', () => {
    expect(matchesShortcut(makeEvent({ key: 'e', metaKey: true }), 'mod+shift+e')).toBe(false)
    expect(
      matchesShortcut(makeEvent({ key: 'e', metaKey: true, shiftKey: true }), 'mod+shift+e')
    ).toBe(true)
  })

  it('matches a plain key combo with no modifiers at all', () => {
    expect(matchesShortcut(makeEvent({ key: 'Escape' }), 'escape')).toBe(true)
  })

  it('rejects an extra unwanted modifier', () => {
    expect(matchesShortcut(makeEvent({ key: 'k', metaKey: true, altKey: true }), 'mod+k')).toBe(
      false
    )
  })
})
