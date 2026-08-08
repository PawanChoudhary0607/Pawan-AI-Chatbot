import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeSelector } from '@/components/settings/ThemeSelector'
import { useSettingsStore } from '@/state/settingsStore'

describe('ThemeSelector', () => {
  beforeEach(() => {
    useSettingsStore.setState({ theme: 'dark' })
  })

  it('renders all five themes', () => {
    render(<ThemeSelector />)
    for (const label of ['Light', 'Dark', 'Minimal', 'Neumorphism', 'Skeuomorphism']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('marks the currently active theme as checked', () => {
    useSettingsStore.setState({ theme: 'neumorphism' })
    render(<ThemeSelector />)
    expect(screen.getByRole('radio', { name: /neumorphism/i })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.getByRole('radio', { name: /^dark$/i })).toHaveAttribute('aria-checked', 'false')
  })

  it('selecting a theme updates settingsStore', async () => {
    render(<ThemeSelector />)
    await userEvent.click(screen.getByRole('radio', { name: /skeuomorphism/i }))
    expect(useSettingsStore.getState().theme).toBe('skeuomorphism')
  })

  it('uses a radiogroup with radio options for assistive technology', () => {
    render(<ThemeSelector />)
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(5)
  })
})
