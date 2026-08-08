import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppShell } from '@/components/layout/AppShell'
import { useConversationStore } from '@/state/conversationStore'
import { useSettingsStore } from '@/state/settingsStore'
import { usePromptStore } from '@/state/promptStore'

describe('AppShell — lazy loading & shortcuts', () => {
  beforeEach(() => {
    useConversationStore.setState({ conversations: {}, activeConversationId: null, folders: {} })
    useSettingsStore.setState({ uiPreferences: {} })
    usePromptStore.setState({ prompts: [] })
  })

  it('lazy-loads and opens the Settings modal', async () => {
    render(<AppShell />)
    await userEvent.click(screen.getByText('⚙ Settings'))

    // The real (dynamically-imported) modal content must eventually appear —
    // proves the lazy import actually resolves through Suspense, not just
    // that a fallback renders forever.
    expect(await screen.findByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
  })

  it('lazy-loads and opens the Prompt Library modal', async () => {
    render(<AppShell />)
    await userEvent.click(screen.getByText('📚 Prompt Library'))

    expect(await screen.findByRole('dialog', { name: 'Prompt Library' })).toBeInTheDocument()
  })

  it('Cmd/Ctrl+K lazy-loads and opens the Command Palette', async () => {
    render(<AppShell />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })

    expect(await screen.findByRole('dialog', { name: 'Command palette' })).toBeInTheDocument()
  })

  it('Cmd/Ctrl+N creates a new conversation', () => {
    render(<AppShell />)
    fireEvent.keyDown(window, { key: 'n', metaKey: true })

    expect(Object.keys(useConversationStore.getState().conversations)).toHaveLength(1)
  })

  it('shows an offline banner when the browser goes offline', () => {
    render(<AppShell />)
    expect(screen.queryByText(/you're offline/i)).not.toBeInTheDocument()

    fireEvent(window, new Event('offline'))

    expect(screen.getByText(/you're offline/i)).toBeInTheDocument()
  })
})
