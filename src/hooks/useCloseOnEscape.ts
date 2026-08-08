import { useEffect } from 'react'

/** Closes a popover/dropdown on Escape. Lighter than useModalA11y — no
 * focus trap, no focus restore — appropriate for small inline menus
 * (row action menus, the model picker, etc) rather than full dialogs. */
export function useCloseOnEscape(enabled: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!enabled) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onClose])
}
