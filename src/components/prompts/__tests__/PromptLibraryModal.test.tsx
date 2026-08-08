import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromptLibraryModal } from '@/components/prompts/PromptLibraryModal'
import { usePromptStore } from '@/state/promptStore'
import { useConversationStore } from '@/state/conversationStore'
import { useComposerInsertStore } from '@/state/composerInsertStore'

describe('PromptLibraryModal', () => {
  beforeEach(() => {
    usePromptStore.setState({ prompts: [] })
    useConversationStore.setState({ conversations: {}, activeConversationId: null, folders: {} })
    useComposerInsertStore.setState({ pending: {} })
  })

  it('creates a new prompt with a title, content, and category', async () => {
    render(<PromptLibraryModal onClose={() => {}} />)

    await userEvent.click(screen.getByText('+ New prompt'))
    await userEvent.type(screen.getByPlaceholderText('Title'), 'Code review')
    await userEvent.type(
      screen.getByPlaceholderText(/prompt content/i),
      'Review this code for bugs'
    )
    await userEvent.type(screen.getByPlaceholderText('Category (optional)'), 'Engineering')
    await userEvent.click(screen.getByText('Create prompt'))

    expect(usePromptStore.getState().prompts).toHaveLength(1)
    expect(usePromptStore.getState().prompts[0]).toMatchObject({
      title: 'Code review',
      content: 'Review this code for bugs',
      category: 'Engineering',
    })
    expect(screen.getByText('Code review')).toBeInTheDocument()
    expect(screen.getByText('Engineering')).toBeInTheDocument() // category group header
  })

  it('search filters the visible prompt list', async () => {
    usePromptStore.getState().createPrompt('Code review', 'Review this code')
    usePromptStore.getState().createPrompt('Blog outline', 'Outline a blog post')

    render(<PromptLibraryModal onClose={() => {}} />)
    await userEvent.type(screen.getByPlaceholderText(/search prompts/i), 'blog')

    expect(screen.getByText('Blog outline')).toBeInTheDocument()
    expect(screen.queryByText('Code review')).not.toBeInTheDocument()
  })

  it('toggles a prompt as favorite and the "Favorites only" filter respects it', async () => {
    usePromptStore.getState().createPrompt('Favorite me', 'x')
    usePromptStore.getState().createPrompt('Not a favorite', 'y')

    render(<PromptLibraryModal onClose={() => {}} />)
    await userEvent.click(screen.getByLabelText('Favorite Favorite me'))
    await userEvent.click(screen.getByLabelText('Favorites only'))

    expect(screen.getByText('Favorite me')).toBeInTheDocument()
    expect(screen.queryByText('Not a favorite')).not.toBeInTheDocument()
  })

  it('deletes a prompt', async () => {
    usePromptStore.getState().createPrompt('Delete me', 'x')
    render(<PromptLibraryModal onClose={() => {}} />)

    await userEvent.click(screen.getByLabelText('Delete Delete me'))

    expect(usePromptStore.getState().prompts).toHaveLength(0)
  })

  it('one-click insert sends the prompt content to the active conversation and closes the modal', async () => {
    const conversationId = useConversationStore.getState().createConversation('openrouter', 'model')
    usePromptStore.getState().createPrompt('Greeting', 'Hello, how can I help?')
    let closed = false

    render(<PromptLibraryModal onClose={() => (closed = true)} />)
    await userEvent.click(screen.getByText('Insert'))

    expect(useComposerInsertStore.getState().pending[conversationId]?.text).toBe(
      'Hello, how can I help?'
    )
    expect(closed).toBe(true)
  })

  it('disables Insert when there is no active conversation', () => {
    usePromptStore.getState().createPrompt('Greeting', 'Hello')
    render(<PromptLibraryModal onClose={() => {}} />)
    expect(screen.getByText('Insert')).toBeDisabled()
  })
})
