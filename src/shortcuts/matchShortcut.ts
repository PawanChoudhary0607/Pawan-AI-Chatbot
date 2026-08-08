export interface ShortcutEventLike {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}

/**
 * Checks whether a keyboard event matches a combo string like "mod+k" or
 * "mod+shift+e". "mod" matches either Cmd (Mac) or Ctrl (everywhere else)
 * so callers don't need to special-case platform. Case-insensitive on the
 * key itself.
 */
export function matchesShortcut(event: ShortcutEventLike, combo: string): boolean {
  const parts = combo.toLowerCase().split('+')
  const key = parts[parts.length - 1]
  const modifiers = new Set(parts.slice(0, -1))

  if (event.key.toLowerCase() !== key) return false

  const wantsMod = modifiers.has('mod')
  const wantsShift = modifiers.has('shift')
  const wantsAlt = modifiers.has('alt')

  const hasMod = event.metaKey || event.ctrlKey
  if (wantsMod !== hasMod) return false
  if (wantsShift !== event.shiftKey) return false
  if (wantsAlt !== event.altKey) return false

  return true
}
