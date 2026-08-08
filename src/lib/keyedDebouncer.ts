/**
 * Debounces actions per independent key. Used by persistenceService so that,
 * for example, rapid updates to one message don't trigger a write per
 * update — while an update to a different message/conversation is
 * unaffected (separate key, separate timer).
 */
export class KeyedDebouncer {
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private pendingActions = new Map<string, () => void>()

  schedule(key: string, action: () => void, waitMs: number): void {
    this.pendingActions.set(key, action)
    const existingTimer = this.timers.get(key)
    if (existingTimer) clearTimeout(existingTimer)

    const timer = setTimeout(() => this.flush(key), waitMs)
    this.timers.set(key, timer)
  }

  /** Immediately run (and clear) the pending action for a key, if any. Used
   * when a stream completes/errors so the final state is committed right
   * away instead of waiting out the debounce window. */
  flush(key: string): void {
    const action = this.pendingActions.get(key)
    const timer = this.timers.get(key)
    if (timer) clearTimeout(timer)
    this.timers.delete(key)
    this.pendingActions.delete(key)
    if (action) action()
  }

  /** Cancel a pending action without running it (e.g. the conversation it
   * belonged to was just deleted). */
  cancel(key: string): void {
    const timer = this.timers.get(key)
    if (timer) clearTimeout(timer)
    this.timers.delete(key)
    this.pendingActions.delete(key)
  }

  /** Flush everything immediately — used on page unload so nothing in a
   * debounce window is lost when the tab closes. */
  flushAll(): void {
    Array.from(this.pendingActions.keys()).forEach((key) => this.flush(key))
  }
}
