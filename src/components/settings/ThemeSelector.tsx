import { useSettingsStore } from '@/state/settingsStore'
import type { AppTheme } from '@/state/settingsStore'

interface ThemeOption {
  id: AppTheme
  label: string
  swatchSurface: string
  swatchAccent: string
}

const THEME_OPTIONS: ThemeOption[] = [
  { id: 'light', label: 'Light', swatchSurface: '#FFFFFF', swatchAccent: '#4F46E5' },
  { id: 'dark', label: 'Dark', swatchSurface: '#0B0D10', swatchAccent: '#6366F1' },
  { id: 'minimal', label: 'Minimal', swatchSurface: '#FAFAF9', swatchAccent: '#334155' },
  { id: 'neumorphism', label: 'Neumorphism', swatchSurface: '#E0E5EC', swatchAccent: '#4E54C8' },
  {
    id: 'skeuomorphism',
    label: 'Skeuomorphism',
    swatchSurface: '#EEE6D6',
    swatchAccent: '#964E20',
  },
]

export function ThemeSelector() {
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)

  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {THEME_OPTIONS.map((option) => {
        const selected = theme === option.id
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(option.id)}
            className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 transition ${
              selected ? 'border-accent ring-1 ring-accent' : 'border-border hover:border-ink-faint'
            }`}
          >
            <span
              className="h-8 w-full rounded-lg border border-black/10"
              style={{
                background: `linear-gradient(135deg, ${option.swatchSurface} 60%, ${option.swatchAccent} 60%)`,
              }}
              aria-hidden="true"
            />
            <span className="text-[11px] text-ink-muted">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
