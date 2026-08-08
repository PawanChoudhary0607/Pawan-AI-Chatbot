import { useEffect, useState } from 'react'

/** Returns a debounced copy of `value`: it only updates `delayMs` after
 * `value` stops changing. The input itself should stay directly bound to
 * fast-changing state (e.g. a controlled <input>) for a responsive feel —
 * only the (potentially expensive) computation driven by the value should
 * read the debounced copy. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
