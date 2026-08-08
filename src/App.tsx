import { useEffect } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { useSettingsStore } from '@/state/settingsStore'

const THEME_CLASSES = ['dark', 'theme-minimal', 'theme-neumorphism', 'theme-skeuomorphism']

function App() {
  const theme = useSettingsStore((s) => s.theme)

  // Keeps <html>'s class in sync with the (possibly just-restored) theme
  // setting. index.html defaults to class="dark" to avoid a flash before
  // hydration; this effect reconciles it with whatever was actually
  // persisted (or the 'dark' default) once the store is ready.
  //
  // 'light' has no class (:root is the light palette already) — every
  // other theme gets exactly one class. Minimal/neumorphism/skeuomorphism
  // are deliberately light-family palettes (see index.css), so they don't
  // also need the 'dark' class — the WCAG contrast fixes gated behind
  // `dark:` variants elsewhere in the app stay correct without change.
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove(...THEME_CLASSES)
    if (theme !== 'light') {
      root.classList.add(theme === 'dark' ? 'dark' : `theme-${theme}`)
    }
  }, [theme])

  return <AppShell />
}

export default App
