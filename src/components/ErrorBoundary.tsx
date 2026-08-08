import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Called once per caught error, in addition to the built-in
   * console.error fallback — the seam for wiring up real error tracking
   * (Sentry, etc.) later without touching this component. */
  onError?: (error: Error, info: ErrorInfo) => void
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Catches render-time exceptions anywhere below it in the tree. Without
 * this, any unhandled error during render unmounts the entire React tree,
 * leaving a blank page with no recovery path — a real risk here given how
 * much of the UI renders unpredictable, model-generated content (markdown,
 * code blocks, JSON, tables).
 *
 * "Retry" re-renders the existing tree in place (cheap, and sufficient for
 * transient errors — e.g. a one-off bad render triggered by a particular
 * streamed chunk). "Reload" does a full page reload for anything Retry
 * doesn't fix, since app state might genuinely be inconsistent.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] caught a render error', error, info)
    this.props.onError?.(error, info)
  }

  private handleRetry = (): void => {
    this.setState({ error: null })
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-surface px-6 text-center text-ink">
        <div className="max-w-sm space-y-3">
          <p className="text-3xl" aria-hidden="true">
            ⚠️
          </p>
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-sm text-ink-muted">
            The app hit an unexpected error and couldn't continue. Your conversations are safely
            stored — trying again usually fixes this.
          </p>
          <details className="rounded-lg border border-border bg-surface-raised p-2 text-left text-xs text-ink-faint">
            <summary className="cursor-pointer select-none">Technical details</summary>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words">
              {error.message}
            </pre>
          </details>
          <div className="flex justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface-raised"
            >
              Reload app
            </button>
          </div>
        </div>
      </div>
    )
  }
}
