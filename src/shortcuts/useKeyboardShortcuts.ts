import { useEffect, useRef } from 'react'
import { matchesShortcut } from '@/shortcuts/matchShortcut'

export type ShortcutHandlers = Record<string, (event: KeyboardEvent) => void>

/**
 * Wires a set of { combo: handler } pairs to a single window keydown
 * listener. Mounted once at the app root — components that need a shortcut
 * register their handler here rather than each adding their own listener.
 *
 * `handlers` is read via a ref rather than being a dependency of the
 * effect: callers (e.g. AppShell) typically pass a fresh object literal on
 * every render, which previously meant the window listener was torn down
 * and re-added on every single render of the app root. The ref keeps the
 * listener itself mounted exactly once for the component's lifetime while
 * `onKeyDown` still always sees the latest handlers.
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      for (const [combo, handler] of Object.entries(handlersRef.current)) {
        if (matchesShortcut(event, combo)) {
          event.preventDefault()
          handler(event)
          return
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
