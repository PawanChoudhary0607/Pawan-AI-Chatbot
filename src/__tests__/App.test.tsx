import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, render } from '@testing-library/react'
import App from '@/App'
import { useSettingsStore } from '@/state/settingsStore'
import { useConversationStore } from '@/state/conversationStore'

describe('App — theme class switching', () => {
  beforeEach(() => {
    useConversationStore.setState({ conversations: {}, activeConversationId: null, folders: {} })
    useSettingsStore.setState({ theme: 'dark' })
  })

  afterEach(() => {
    document.documentElement.className = 'dark' // restore index.html's default
  })

  it('applies the "dark" class for the dark theme', () => {
    useSettingsStore.setState({ theme: 'dark' })
    render(<App />)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('applies no theme class for the light theme', () => {
    useSettingsStore.setState({ theme: 'light' })
    render(<App />)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.className.trim()).toBe('')
  })

  it.each([
    ['minimal', 'theme-minimal'],
    ['neumorphism', 'theme-neumorphism'],
    ['skeuomorphism', 'theme-skeuomorphism'],
  ] as const)('applies "%s" -> class "%s"', (theme, expectedClass) => {
    useSettingsStore.setState({ theme })
    render(<App />)
    expect(document.documentElement.classList.contains(expectedClass)).toBe(true)
  })

  it('switching themes at runtime updates the class immediately, without a reload', () => {
    render(<App />)
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    act(() => {
      useSettingsStore.getState().setTheme('skeuomorphism')
    })

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.classList.contains('theme-skeuomorphism')).toBe(true)
  })

  it('never applies more than one theme class at a time', () => {
    render(<App />)
    act(() => {
      useSettingsStore.getState().setTheme('neumorphism')
    })
    act(() => {
      useSettingsStore.getState().setTheme('minimal')
    })

    const themeClasses = ['dark', 'theme-minimal', 'theme-neumorphism', 'theme-skeuomorphism']
    const applied = themeClasses.filter((c) => document.documentElement.classList.contains(c))
    expect(applied).toEqual(['theme-minimal'])
  })
})
