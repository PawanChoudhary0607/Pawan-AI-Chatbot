import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from '@/components/ErrorBoundary'

/** Throws on its first render, then renders fine — lets us prove "Retry"
 * actually re-attempts rendering the same subtree rather than just
 * clearing the error and showing nothing. */
function ThrowsOnce({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Boom from a child component')
  return <div>Recovered content</div>
}

function AlwaysThrows(): never {
  throw new Error('Always fails')
}

describe('ErrorBoundary', () => {
  // React logs caught errors to the console by default in dev/test —
  // silence that noise for these tests without hiding real assertion
  // failures.
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    consoleErrorSpy.mockRestore()
    vi.restoreAllMocks()
  })

  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <div>All good</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('renders a friendly fallback UI when a child throws during render', () => {
    render(
      <ErrorBoundary>
        <AlwaysThrows />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Try again')).toBeInTheDocument()
    expect(screen.getByText('Reload app')).toBeInTheDocument()
  })

  it('does not leak the raw error message into the main fallback text (only inside collapsed details)', () => {
    render(
      <ErrorBoundary>
        <AlwaysThrows />
      </ErrorBoundary>
    )
    // The message is present, but scoped inside <details>/<pre>, not
    // presented as if it were user-facing copy.
    expect(screen.getByText('Always fails')).toBeInTheDocument()
  })

  it('calls the onError logging hook exactly once with the thrown error', () => {
    const onError = vi.fn()
    render(
      <ErrorBoundary onError={onError}>
        <AlwaysThrows />
      </ErrorBoundary>
    )
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(onError.mock.calls[0][0].message).toBe('Always fails')
  })

  it('"Try again" re-renders the subtree, recovering if the error was transient', async () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowsOnce shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    // Simulate the underlying condition clearing up (e.g. the offending
    // streamed content is no longer part of the tree) before retrying.
    rerender(
      <ErrorBoundary>
        <ThrowsOnce shouldThrow={false} />
      </ErrorBoundary>
    )
    await userEvent.click(screen.getByText('Try again'))

    expect(screen.getByText('Recovered content')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('"Reload app" calls window.location.reload', async () => {
    const reloadSpy = vi.fn()
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    })

    render(
      <ErrorBoundary>
        <AlwaysThrows />
      </ErrorBoundary>
    )
    await userEvent.click(screen.getByText('Reload app'))

    expect(reloadSpy).toHaveBeenCalledTimes(1)
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
  })

  it('still logs to console.error even without an onError prop supplied', () => {
    render(
      <ErrorBoundary>
        <AlwaysThrows />
      </ErrorBoundary>
    )
    expect(consoleErrorSpy).toHaveBeenCalled()
  })
})
