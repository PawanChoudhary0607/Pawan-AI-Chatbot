import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { useConversationStore } from '@/state/conversationStore'
import { useSettingsStore } from '@/state/settingsStore'

function setup(overrides: Partial<Record<string, unknown>> = {}) {
  const noop = () => {}
  return render(
    <Sidebar
      mobileOpen={false}
      onCloseMobile={noop}
      onOpenSettings={noop}
      onOpenPromptLibrary={noop}
      onOpenProjects={noop}
      {...overrides}
    />
  )
}

describe('Sidebar', () => {
  beforeEach(() => {
    useConversationStore.setState({ conversations: {}, activeConversationId: null, folders: {} })
    useSettingsStore.setState({ uiPreferences: {} })
  })

  it('lists conversations and lets the user open one', async () => {
    const idA = useConversationStore.getState().createConversation('openrouter', 'model-a')
    useConversationStore.getState().renameConversation(idA, 'First chat')
    const idB = useConversationStore.getState().createConversation('openrouter', 'model-b')
    useConversationStore.getState().renameConversation(idB, 'Second chat')

    setup()
    expect(screen.getByText('First chat')).toBeInTheDocument()
    expect(screen.getByText('Second chat')).toBeInTheDocument()

    await userEvent.click(screen.getByText('First chat'))
    expect(useConversationStore.getState().activeConversationId).toBe(idA)
  })

  it('search filters the conversation list by title', async () => {
    const idA = useConversationStore.getState().createConversation('openrouter', 'model-a')
    useConversationStore.getState().renameConversation(idA, 'Trip to Japan')
    const idB = useConversationStore.getState().createConversation('openrouter', 'model-b')
    useConversationStore.getState().renameConversation(idB, 'Recipe ideas')

    setup()
    await userEvent.type(screen.getByLabelText('Search conversations'), 'trip')

    expect(screen.getByRole('button', { name: 'Trip to Japan' })).toBeInTheDocument()
    expect(screen.queryByText('Recipe ideas')).not.toBeInTheDocument()
  })

  it('search also matches message content, not just titles', async () => {
    const id = useConversationStore.getState().createConversation('openrouter', 'model-a')
    useConversationStore.getState().appendMessage(id, {
      id: 'm1',
      role: 'user',
      content: 'Tell me about quantum computing',
      status: 'complete',
      createdAt: Date.now(),
    })

    setup()
    await userEvent.type(screen.getByLabelText('Search conversations'), 'quantum')

    // The conversation's (default) title should still be listed since its
    // message content matched.
    await waitFor(() => expect(screen.getByText('New conversation')).toBeInTheDocument())
  })

  it('renames a conversation via the row action menu', async () => {
    const id = useConversationStore.getState().createConversation('openrouter', 'model-a')
    useConversationStore.getState().renameConversation(id, 'Original title')

    setup()
    await userEvent.click(screen.getByLabelText('More actions for Original title'))
    await userEvent.click(screen.getByText('Rename'))

    const input = screen.getByDisplayValue('Original title')
    await userEvent.clear(input)
    await userEvent.type(input, 'Updated title{Enter}')

    expect(useConversationStore.getState().conversations[id].title).toBe('Updated title')
  })

  it('archives a conversation, which removes it from the main list and shows it under Archived', async () => {
    const id = useConversationStore.getState().createConversation('openrouter', 'model-a')
    useConversationStore.getState().renameConversation(id, 'To be archived')

    setup()
    await userEvent.click(screen.getByLabelText('More actions for To be archived'))
    await userEvent.click(screen.getByText('Archive'))

    expect(screen.queryByRole('button', { name: 'To be archived' })).not.toBeInTheDocument()
    expect(useConversationStore.getState().conversations[id].archived).toBe(true)

    await userEvent.click(screen.getByText(/Archived \(1\)/))
    expect(screen.getByText('To be archived')).toBeInTheDocument()
  })

  it('restores an archived conversation from the Archived section', async () => {
    const id = useConversationStore.getState().createConversation('openrouter', 'model-a')
    useConversationStore.getState().renameConversation(id, 'Archived chat')
    useConversationStore.getState().toggleArchived(id)

    setup()
    await userEvent.click(screen.getByText(/Archived \(1\)/))
    await userEvent.click(screen.getByText('Restore'))

    expect(useConversationStore.getState().conversations[id].archived).toBe(false)
    expect(screen.getByText('Archived chat')).toBeInTheDocument()
  })

  it('deletes a conversation via the row action menu', async () => {
    const id = useConversationStore.getState().createConversation('openrouter', 'model-a')
    useConversationStore.getState().renameConversation(id, 'Delete me')

    setup()
    await userEvent.click(screen.getByLabelText('More actions for Delete me'))
    await userEvent.click(screen.getByText('Delete'))

    expect(useConversationStore.getState().conversations[id]).toBeUndefined()
    expect(screen.queryByText('Delete me')).not.toBeInTheDocument()
  })

  it('pins a conversation, showing it in a Pinned section', async () => {
    const id = useConversationStore.getState().createConversation('openrouter', 'model-a')
    useConversationStore.getState().renameConversation(id, 'Pin me')

    setup()
    await userEvent.click(screen.getByLabelText('More actions for Pin me'))
    await userEvent.click(screen.getByText('Pin'))

    expect(useConversationStore.getState().conversations[id].pinned).toBe(true)
    expect(screen.getByText('Pinned')).toBeInTheDocument()
  })

  it('creates a folder and can move a conversation into it', async () => {
    const id = useConversationStore.getState().createConversation('openrouter', 'model-a')
    useConversationStore.getState().renameConversation(id, 'Filed chat')

    setup()
    await userEvent.click(screen.getByText('+ New folder'))
    await userEvent.type(screen.getByPlaceholderText('Folder name'), 'Research{Enter}')

    expect(Object.values(useConversationStore.getState().folders).map((f) => f.name)).toContain(
      'Research'
    )

    await userEvent.click(screen.getByLabelText('More actions for Filed chat'))
    const folderSelect = screen.getByLabelText('Folder') as HTMLSelectElement
    await userEvent.selectOptions(folderSelect, 'Research')

    const folderId = Object.values(useConversationStore.getState().folders).find(
      (f) => f.name === 'Research'
    )?.id
    expect(useConversationStore.getState().conversations[id].folderId).toBe(folderId)
  })
})
