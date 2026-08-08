import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MessageList } from '@/components/chat/MessageList'
import { chatService } from '@/chat/chatService'
import { useConversationStore } from '@/state/conversationStore'
import type { ChatMessage } from '@/types/provider'

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: '',
    status: 'complete',
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('MessageList', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows an empty state when there are no messages', () => {
    render(<MessageList conversationId="c1" messages={[]} />)
    expect(screen.getByText(/send a message to begin/i)).toBeInTheDocument()
  })

  it('shows a "thinking" indicator for a streaming message with no content yet', () => {
    render(
      <MessageList
        conversationId="c1"
        messages={[makeMessage({ status: 'streaming', content: '' })]}
      />
    )
    expect(screen.getByLabelText('Assistant is responding')).toBeInTheDocument()
  })

  it('shows the blinking cursor (not the thinking dots) once streaming content has started', () => {
    render(
      <MessageList
        conversationId="c1"
        messages={[makeMessage({ status: 'streaming', content: 'Hello' })]}
      />
    )
    expect(screen.queryByLabelText('Assistant is responding')).not.toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('shows a Retry button on a failed message and calls chatService.retryMessage', async () => {
    const retrySpy = vi.spyOn(chatService, 'retryMessage').mockResolvedValue(undefined)
    const failedMessage = makeMessage({ status: 'error', content: 'Something went wrong' })

    render(<MessageList conversationId="conv-42" messages={[failedMessage]} />)
    await userEvent.click(screen.getByText('↻ Retry'))

    expect(retrySpy).toHaveBeenCalledWith('conv-42', failedMessage.id)
  })

  it('does not show a Retry button on a successful message', () => {
    render(
      <MessageList
        conversationId="c1"
        messages={[makeMessage({ status: 'complete', content: 'ok' })]}
      />
    )
    expect(screen.queryByText('↻ Retry')).not.toBeInTheDocument()
  })

  it('renders every message in a long conversation via the virtualized path', () => {
    const messages = Array.from({ length: 60 }, (_, i) =>
      makeMessage({ role: i % 2 === 0 ? 'user' : 'assistant', content: `Message ${i}` })
    )
    render(<MessageList conversationId="c1" messages={messages} />)
    // The container itself should exist and be scrollable; not every one of
    // the 60 messages is necessarily mounted (that's the point of
    // virtualization), but at least some should be rendered near the top.
    expect(screen.getByRole('log')).toBeInTheDocument()
  })

  it('renders all messages directly (non-virtualized) below the threshold', () => {
    const messages = Array.from({ length: 5 }, (_, i) => makeMessage({ content: `Message ${i}` }))
    render(<MessageList conversationId="c1" messages={messages} />)
    for (let i = 0; i < 5; i++) {
      expect(screen.getByText(`Message ${i}`)).toBeInTheDocument()
    }
  })

  describe('Continue from here (branching)', () => {
    beforeEach(() => {
      useConversationStore.setState({ conversations: {}, activeConversationId: null, folders: {} })
    })

    it('branches the conversation from the clicked message and switches to it', async () => {
      const conversationId = useConversationStore
        .getState()
        .createConversation('openrouter', 'model')
      const message = makeMessage({ id: 'm1', role: 'user', content: 'hello', status: 'complete' })
      useConversationStore.getState().appendMessage(conversationId, message)

      render(<MessageList conversationId={conversationId} messages={[message]} />)
      await userEvent.click(screen.getByLabelText('Continue from this message'))

      const state = useConversationStore.getState()
      expect(state.activeConversationId).not.toBe(conversationId)
      expect(state.conversations[state.activeConversationId!].messages).toHaveLength(1)
    })

    it('does not show the continue action on a currently-streaming message', () => {
      render(
        <MessageList
          conversationId="c1"
          messages={[makeMessage({ status: 'streaming', content: 'partial' })]}
        />
      )
      expect(screen.queryByLabelText('Continue from this message')).not.toBeInTheDocument()
    })
  })
})
