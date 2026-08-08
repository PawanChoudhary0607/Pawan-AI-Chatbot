import { useEffect, useState } from 'react'

/** Returns false on the render right after mount, then true one animation
 * frame later — toggle opacity/scale classes on this to get a subtle
 * fade+scale-in without any animation library. Deliberately enter-only. */
export function useEnterTransition(): boolean {
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(raf)
  }, [])
  return entered
}
