import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

function TestComponent({ value, delayMs }: { value: string; delayMs: number }) {
  const debounced = useDebouncedValue(value, delayMs)
  return <span>{debounced}</span>
}

describe('useDebouncedValue', () => {
  it('returns the initial value immediately', () => {
    render(<TestComponent value="first" delayMs={100} />)
    expect(screen.getByText('first')).toBeInTheDocument()
  })

  it('does not update immediately when the input value changes', () => {
    vi.useFakeTimers()
    const { rerender } = render(<TestComponent value="first" delayMs={100} />)
    rerender(<TestComponent value="second" delayMs={100} />)

    expect(screen.getByText('first')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('updates to the latest value once the delay elapses', () => {
    vi.useFakeTimers()
    const { rerender } = render(<TestComponent value="first" delayMs={100} />)
    rerender(<TestComponent value="second" delayMs={100} />)

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(screen.getByText('second')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('resets the timer on each change — rapid changes only produce one update, for the final value', () => {
    vi.useFakeTimers()
    const { rerender } = render(<TestComponent value="a" delayMs={100} />)
    rerender(<TestComponent value="ab" delayMs={100} />)
    act(() => {
      vi.advanceTimersByTime(50)
    })
    rerender(<TestComponent value="abc" delayMs={100} />)
    act(() => {
      vi.advanceTimersByTime(50)
    })

    // Only 50ms since the last change ("abc") — still showing the original value.
    expect(screen.getByText('a')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(screen.getByText('abc')).toBeInTheDocument()
    vi.useRealTimers()
  })
})
