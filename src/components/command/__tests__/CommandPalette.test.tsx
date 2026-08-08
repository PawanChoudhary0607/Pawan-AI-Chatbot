import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CommandPalette } from '@/components/command/CommandPalette'
import { useConversationStore } from '@/state/conversationStore'
import { usePromptStore } from '@/state/promptStore'
import { useSettingsStore } from '@/state/settingsStore'
import { useComposerInsertStore } from '@/state/composerInsertStore'

describe('CommandPalette', () => {
  beforeEach(() => {
    useConversationStore.setState({ conversations: {}, activeConversationId: null, folders: {} })
    usePromptStore.setState({ prompts: [] })
    useSettingsStore.setState({ theme: 'dark', defaultProviderId: null, defaultModel: null })
    useComposerInsertStore.setState({ pending: {} })
  })

  it('shows quick actions by default (no query)', () => {
    render(<CommandPalette onClose={() => {}} />)
    expect(screen.getByText('New conversation')).toBeInTheDocument()
    expect(screen.getByText(/switch to (light|dark) theme/i)).toBeInTheDocument()
  })

  it('running "New conversation" creates one and closes the palette', async () => {
    let closed = false
    render(<CommandPalette onClose={() => (closed = true)} />)

    await userEvent.click(screen.getByText('New conversation'))

    expect(Object.keys(useConversationStore.getState().conversations)).toHaveLength(1)
    expect(closed).toBe(true)
  })

  it('searches and selects a matching conversation', async () => {
    const idA = useConversationStore.getState().createConversation('openrouter', 'model-a')
    useConversationStore.getState().renameConversation(idA, 'Trip to Japan')
    useConversationStore.getState().createConversation('openrouter', 'model-b')

    let closed = false
    render(<CommandPalette onClose={() => (closed = true)} />)
    await userEvent.type(screen.getByPlaceholderText(/search conversations/i), 'Japan')

    expect(await screen.findByText('Conversations')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Trip to Japan' }))

    expect(useConversationStore.getState().activeConversationId).toBe(idA)
    expect(closed).toBe(true)
  })

  it('searches and inserts a matching prompt into the active conversation', async () => {
    const conversationId = useConversationStore.getState().createConversation('openrouter', 'model')
    usePromptStore.getState().createPrompt('Code review', 'Please review this code')

    render(<CommandPalette onClose={() => {}} />)
    await userEvent.type(screen.getByPlaceholderText(/search conversations/i), 'code review')

    expect(await screen.findByText('Prompts')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Code review'))

    expect(useComposerInsertStore.getState().pending[conversationId]?.text).toBe(
      'Please review this code'
    )
  })

  it('keyboard navigation (ArrowDown + Enter) runs the selected item', async () => {
    render(<CommandPalette onClose={() => {}} />)
    const input = screen.getByPlaceholderText(/search conversations/i)

    // Default actions: ['New conversation', 'Switch to light/dark theme'].
    // ArrowDown once selects the second action; Enter runs it.
    await userEvent.type(input, '{ArrowDown}{Enter}')

    // Running the theme toggle should have flipped the theme.
    expect(useSettingsStore.getState().theme).toBe('light')
  })

  it('Escape closes the palette', async () => {
    let closed = false
    render(<CommandPalette onClose={() => (closed = true)} />)
    await userEvent.type(screen.getByPlaceholderText(/search conversations/i), '{Escape}')
    expect(closed).toBe(true)
  })

  it('shows no-match state for a query that matches nothing', async () => {
    render(<CommandPalette onClose={() => {}} />)
    await userEvent.type(screen.getByPlaceholderText(/search conversations/i), 'zzzznomatch')
    expect(await screen.findByText('No matches.')).toBeInTheDocument()
  })

  it('offers quick model switching when models are loaded for the active conversation provider', async () => {
    const conversationId = useConversationStore
      .getState()
      .createConversation('openrouter', 'model-a')
    useSettingsStore.getState().setModels('openrouter', [
      { id: 'model-a', name: 'Model A' },
      { id: 'model-b', name: 'Model B' },
    ])

    render(<CommandPalette onClose={() => {}} />)
    await userEvent.type(screen.getByPlaceholderText(/search conversations/i), 'Model B')

    await userEvent.click(await screen.findByText('Switch model to Model B'))
    expect(useConversationStore.getState().conversations[conversationId].model).toBe('model-b')
  })
})
