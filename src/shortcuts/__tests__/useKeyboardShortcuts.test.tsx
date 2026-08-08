import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { useKeyboardShortcuts } from '@/shortcuts/useKeyboardShortcuts'

function TestComponent({ handlers }: { handlers: Record<string, () => void> }) {
  useKeyboardShortcuts(handlers)
  return null
}

function dispatchKeydown(overrides: Partial<KeyboardEventInit> = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...overrides }))
}

describe('useKeyboardShortcuts', () => {
  it('invokes the matching handler for a registered combo', () => {
    const handler = vi.fn()
    render(<TestComponent handlers={{ 'mod+k': handler }} />)

    dispatchKeydown({ key: 'k', metaKey: true })

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does not invoke the handler for a non-matching key', () => {
    const handler = vi.fn()
    render(<TestComponent handlers={{ 'mod+k': handler }} />)

    dispatchKeydown({ key: 'j', metaKey: true })

    expect(handler).not.toHaveBeenCalled()
  })

  it('removes its listener on unmount', () => {
    const handler = vi.fn()
    const { unmount } = render(<TestComponent handlers={{ 'mod+k': handler }} />)
    unmount()

    dispatchKeydown({ key: 'k', metaKey: true })

    expect(handler).not.toHaveBeenCalled()
  })

  it('supports multiple registered shortcuts independently', () => {
    const openPalette = vi.fn()
    const newChat = vi.fn()
    render(<TestComponent handlers={{ 'mod+k': openPalette, 'mod+n': newChat }} />)

    dispatchKeydown({ key: 'n', metaKey: true })

    expect(newChat).toHaveBeenCalledTimes(1)
    expect(openPalette).not.toHaveBeenCalled()
  })

  it('re-rendering with a fresh handlers object (same shape) does not add a second listener', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const handler = vi.fn()
    const { rerender } = render(<TestComponent handlers={{ 'mod+k': handler }} />)
    const callsAfterMount = addSpy.mock.calls.filter((c) => c[0] === 'keydown').length

    // A brand-new object literal every render, exactly like AppShell passes —
    // this is the scenario that previously caused the window listener to be
    // torn down and re-added on every single render.
    rerender(<TestComponent handlers={{ 'mod+k': handler }} />)
    rerender(<TestComponent handlers={{ 'mod+k': handler }} />)

    const callsAfterRerenders = addSpy.mock.calls.filter((c) => c[0] === 'keydown').length
    expect(callsAfterRerenders).toBe(callsAfterMount)
    addSpy.mockRestore()
  })

  it('still uses the latest handler after a re-render passes a new handler function', () => {
    const firstHandler = vi.fn()
    const secondHandler = vi.fn()
    const { rerender } = render(<TestComponent handlers={{ 'mod+k': firstHandler }} />)

    rerender(<TestComponent handlers={{ 'mod+k': secondHandler }} />)
    dispatchKeydown({ key: 'k', metaKey: true })

    expect(firstHandler).not.toHaveBeenCalled()
    expect(secondHandler).toHaveBeenCalledTimes(1)
  })
})
