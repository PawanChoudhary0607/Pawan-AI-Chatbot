import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ArtifactsPanel } from '@/components/artifacts/ArtifactsPanel'
import type { Conversation } from '@/types/conversation'

function makeConversation(messagesContent: string[]): Conversation {
  const now = Date.now()
  return {
    id: 'conv-1',
    title: 'Test',
    providerId: 'openrouter',
    model: 'test-model',
    temperature: 0.7,
    topP: 1,
    pinned: false,
    archived: false,
    lastOpenedAt: now,
    messages: messagesContent.map((content, i) => ({
      id: `m${i}`,
      role: 'assistant' as const,
      content,
      status: 'complete' as const,
      createdAt: now,
    })),
    createdAt: now,
    updatedAt: now,
  }
}

describe('ArtifactsPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows an empty state when the conversation has no artifacts', () => {
    render(
      <ArtifactsPanel conversation={makeConversation(['Just a short reply.'])} onClose={() => {}} />
    )
    expect(screen.getByText(/no artifacts yet/i)).toBeInTheDocument()
  })

  it('renders an extracted code artifact with its language badge', () => {
    render(
      <ArtifactsPanel
        conversation={makeConversation(['```python\nprint("hi")\n```'])}
        onClose={() => {}}
      />
    )
    expect(screen.getByText(/code · python/i)).toBeInTheDocument()
    expect(screen.getByText(/print\("hi"\)/)).toBeInTheDocument()
  })

  it('renders a JSON artifact distinctly from a code artifact', () => {
    render(
      <ArtifactsPanel
        conversation={makeConversation(['```json\n{"a":1}\n```', '```js\nconsole.log(1)\n```'])}
        onClose={() => {}}
      />
    )
    expect(screen.getByText('JSON')).toBeInTheDocument()
    expect(screen.getByText(/code · js/i)).toBeInTheDocument()
  })

  it('shows the artifact count in the header', () => {
    render(
      <ArtifactsPanel
        conversation={makeConversation(['```json\n{"a":1}\n```', '```py\nx=1\n```'])}
        onClose={() => {}}
      />
    )
    expect(screen.getByText('Artifacts (2)')).toBeInTheDocument()
  })

  it('triggers a download when the download button is clicked', async () => {
    const clickSpy = vi.fn()
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreateElement(tag)
      if (tag === 'a') el.click = clickSpy
      return el
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    render(
      <ArtifactsPanel
        conversation={makeConversation(['```python\nprint("hi")\n```'])}
        onClose={() => {}}
      />
    )
    await userEvent.click(screen.getByLabelText(/download/i))

    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn()
    render(<ArtifactsPanel conversation={makeConversation(['x'])} onClose={onClose} />)
    await userEvent.click(screen.getByLabelText('Close artifacts'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
