import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Composer } from '@/components/chat/Composer'
import { useConversationStore } from '@/state/conversationStore'
import { useAttachmentStore } from '@/state/attachmentStore'
import { providerRegistry } from '@/providers/registry'
import { chatService } from '@/chat/chatService'
import { DEFAULT_CAPABILITIES } from '@/providers/defaultCapabilities'
import type { ChatProvider, ProviderCapabilities } from '@/types/provider'

function makeFakeProvider(id: string, capabilities: Partial<ProviderCapabilities>): ChatProvider {
  const fullCapabilities: ProviderCapabilities = { ...DEFAULT_CAPABILITIES, ...capabilities }
  return {
    meta: {
      id,
      name: `Fake (${id})`,
      isLocal: false,
      requiresKey: false,
      credentialFields: [],
      capabilities: fullCapabilities,
    },
    validateKey: async () => ({ valid: true }),
    listModels: async () => [],
    sendMessage: async () => ({ content: '' }),
    async *streamMessage() {
      yield { type: 'done' as const }
    },
    estimateCost: () => ({ inputTokens: 0, outputTokens: 0, isEstimate: true }),
    estimateContext: () => ({ usedTokens: 0, isEstimate: true }),
    supportsCapability: (cap) => Boolean(fullCapabilities[cap]),
  }
}

function setupConversation(conversationId: string, providerId: string) {
  useConversationStore.setState({
    conversations: {
      [conversationId]: {
        id: conversationId,
        title: 'Test',
        providerId,
        model: 'test-model',
        temperature: 0.7,
        topP: 1,
        pinned: false,
        archived: false,
        lastOpenedAt: Date.now(),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    },
    activeConversationId: conversationId,
  })
}

function makeFile(name: string, content: string, type: string): File {
  return new File([content], name, { type })
}

/** Waits until every attachment currently in this conversation's snapshot
 * has settled into a terminal-for-this-test state (ready or failed) —
 * i.e. async processing (FileReader + markProcessed/markReady) has fully
 * finished. Without this, a test can move on (or end) while a promise is
 * still in flight, which then resolves during a LATER test after
 * beforeEach has already cleared/replaced the pipeline, throwing an
 * "Unknown attachment id" unhandled rejection. */
async function waitForAttachmentsSettled(conversationId: string, expectedCount = 1) {
  await waitFor(() => {
    const items = useAttachmentStore.getState().snapshots[conversationId] ?? []
    expect(items).toHaveLength(expectedCount)
    items.forEach((item) => {
      expect(['ready', 'failed']).toContain(item.processingStatus)
    })
  })
}

describe('Composer — attachments', () => {
  const conversationId = 'conv-1'

  beforeEach(() => {
    useAttachmentStore.getState().clear(conversationId)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uploads a file via the hidden file input (click-to-upload path)', async () => {
    const providerId = `fake-${crypto.randomUUID()}`
    providerRegistry.register(makeFakeProvider(providerId, { documentInput: true }))
    setupConversation(conversationId, providerId)

    render(<Composer conversationId={conversationId} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, makeFile('notes.txt', 'hello world', 'text/plain'))

    await waitForAttachmentsSettled(conversationId)
    expect(screen.getByText('notes.txt')).toBeInTheDocument()
    expect(useAttachmentStore.getState().snapshots[conversationId][0].processingStatus).toBe(
      'ready'
    )
  })

  it('adds a file via drag & drop', async () => {
    const providerId = `fake-${crypto.randomUUID()}`
    providerRegistry.register(makeFakeProvider(providerId, { documentInput: true }))
    setupConversation(conversationId, providerId)

    const { container } = render(<Composer conversationId={conversationId} />)
    const dropZone = container.firstElementChild as HTMLElement
    const dataTransfer = { files: [makeFile('report.csv', 'a,b,c', 'text/csv')] }

    fireEvent.dragOver(dropZone, { dataTransfer })
    fireEvent.drop(dropZone, { dataTransfer })

    await waitForAttachmentsSettled(conversationId)
    expect(screen.getByText('report.csv')).toBeInTheDocument()
    expect(useAttachmentStore.getState().snapshots[conversationId][0].processingStatus).toBe(
      'ready'
    )
  })

  it('adds an image pasted from the clipboard', async () => {
    const providerId = `fake-${crypto.randomUUID()}`
    providerRegistry.register(makeFakeProvider(providerId, { vision: true }))
    setupConversation(conversationId, providerId)

    render(<Composer conversationId={conversationId} />)
    const textarea = screen.getByPlaceholderText(/message pawan ai chatbot/i)
    const file = makeFile('image.png', 'fake-image-bytes', 'image/png')

    fireEvent.paste(textarea, {
      clipboardData: { items: [{ kind: 'file', getAsFile: () => file }] },
    })

    await waitForAttachmentsSettled(conversationId)
    expect(screen.getByText('image.png')).toBeInTheDocument()
    expect(useAttachmentStore.getState().snapshots[conversationId][0].processingStatus).toBe(
      'ready'
    )
    // Images get a preview URL once ready (used for the chip thumbnail).
    expect(useAttachmentStore.getState().snapshots[conversationId][0].previewUrl).toBeDefined()
  })

  it('supports multiple attachments at once', async () => {
    const providerId = `fake-${crypto.randomUUID()}`
    providerRegistry.register(makeFakeProvider(providerId, { documentInput: true }))
    setupConversation(conversationId, providerId)

    render(<Composer conversationId={conversationId} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, [
      makeFile('a.txt', 'aaa', 'text/plain'),
      makeFile('b.md', '# b', 'text/markdown'),
    ])

    await waitForAttachmentsSettled(conversationId, 2)
    expect(screen.getByText('a.txt')).toBeInTheDocument()
    expect(screen.getByText('b.md')).toBeInTheDocument()
  })

  it('shows a validation error and blocks an oversized file from becoming attachable', async () => {
    const providerId = `fake-${crypto.randomUUID()}`
    providerRegistry.register(makeFakeProvider(providerId, { documentInput: true }))
    setupConversation(conversationId, providerId)

    render(<Composer conversationId={conversationId} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = makeFile('huge.txt', 'x', 'text/plain')
    Object.defineProperty(file, 'size', { value: 25 * 1024 * 1024 }) // exceeds the 20MB default rule
    await userEvent.upload(input, file)

    // Validation runs synchronously inside add() — no need to wait for
    // async processing since a failed candidate never reaches it.
    expect(screen.getByText(/exceeds the maximum size/i)).toBeInTheDocument()
    expect(useAttachmentStore.getState().snapshots[conversationId][0].processingStatus).toBe(
      'failed'
    )
  })

  it('shows a validation error for an unsupported file type', async () => {
    const providerId = `fake-${crypto.randomUUID()}`
    providerRegistry.register(makeFakeProvider(providerId, { documentInput: true }))
    setupConversation(conversationId, providerId)

    render(<Composer conversationId={conversationId} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, makeFile('archive.zip', 'zzz', 'application/zip'))

    expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument()
    expect(useAttachmentStore.getState().snapshots[conversationId][0].processingStatus).toBe(
      'failed'
    )
  })

  it('rejects a duplicate attachment (same name/size/type)', async () => {
    const providerId = `fake-${crypto.randomUUID()}`
    providerRegistry.register(makeFakeProvider(providerId, { documentInput: true }))
    setupConversation(conversationId, providerId)

    render(<Composer conversationId={conversationId} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, makeFile('same.txt', 'identical content', 'text/plain'))
    await waitForAttachmentsSettled(conversationId)

    await userEvent.upload(input, makeFile('same.txt', 'identical content', 'text/plain'))

    // The duplicate fails validation synchronously, landing immediately —
    // no need to wait, and it must not disturb the first (still-ready) item.
    await waitFor(() =>
      expect(useAttachmentStore.getState().snapshots[conversationId]).toHaveLength(2)
    )
    const [first, second] = useAttachmentStore.getState().snapshots[conversationId]
    expect(first.processingStatus).toBe('ready')
    expect(second.processingStatus).toBe('failed')
    expect(second.error).toMatch(/already attached/i)
  })

  it('removes an attachment via its remove button', async () => {
    const providerId = `fake-${crypto.randomUUID()}`
    providerRegistry.register(makeFakeProvider(providerId, { documentInput: true }))
    setupConversation(conversationId, providerId)

    render(<Composer conversationId={conversationId} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, makeFile('remove-me.txt', 'x', 'text/plain'))
    await waitForAttachmentsSettled(conversationId)

    await userEvent.click(screen.getByLabelText('Remove remove-me.txt'))

    await waitFor(() => expect(screen.queryByText('remove-me.txt')).not.toBeInTheDocument())
    expect(useAttachmentStore.getState().snapshots[conversationId] ?? []).toHaveLength(0)
  })

  it('flags an attachment the provider cannot accept, explains why, and disables Send until it is removed', async () => {
    const providerId = `fake-${crypto.randomUUID()}`
    // documentInput NOT declared -> a text file is incompatible with this provider.
    providerRegistry.register(makeFakeProvider(providerId, {}))
    setupConversation(conversationId, providerId)

    render(<Composer conversationId={conversationId} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, makeFile('notes.txt', 'hello', 'text/plain'))
    await waitForAttachmentsSettled(conversationId)

    expect(screen.getByText(/doesn't support document attachments/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()

    await userEvent.click(screen.getByLabelText('Remove notes.txt'))
    await waitFor(() => expect(screen.queryByText('notes.txt')).not.toBeInTheDocument())
  })

  it('sends successfully with a compatible attachment, passing the wire-format Attachment to chatService and clearing the composer', async () => {
    const providerId = `fake-${crypto.randomUUID()}`
    providerRegistry.register(makeFakeProvider(providerId, { vision: true }))
    setupConversation(conversationId, providerId)
    const sendSpy = vi.spyOn(chatService, 'sendUserMessage').mockResolvedValue(undefined)

    render(<Composer conversationId={conversationId} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, makeFile('photo.png', 'fake-bytes', 'image/png'))
    await waitForAttachmentsSettled(conversationId)

    const textarea = screen.getByPlaceholderText(/message pawan ai chatbot/i)
    await userEvent.type(textarea, 'What is this?')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).not.toBeDisabled())
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(sendSpy).toHaveBeenCalledTimes(1))
    const [sentConversationId, sentText, sentAttachments] = sendSpy.mock.calls[0]
    expect(sentConversationId).toBe(conversationId)
    expect(sentText).toBe('What is this?')
    expect(sentAttachments).toEqual([
      expect.objectContaining({ kind: 'image', name: 'photo.png', mimeType: 'image/png' }),
    ])

    // Composer resets after a successful send.
    expect(useAttachmentStore.getState().snapshots[conversationId] ?? []).toHaveLength(0)
    expect(textarea).toHaveValue('')
  })

  it('allows sending an attachment with no text at all', async () => {
    const providerId = `fake-${crypto.randomUUID()}`
    providerRegistry.register(makeFakeProvider(providerId, { vision: true }))
    setupConversation(conversationId, providerId)
    const sendSpy = vi.spyOn(chatService, 'sendUserMessage').mockResolvedValue(undefined)

    render(<Composer conversationId={conversationId} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, makeFile('photo.png', 'fake-bytes', 'image/png'))
    await waitForAttachmentsSettled(conversationId)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).not.toBeDisabled())
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(sendSpy).toHaveBeenCalledTimes(1))
    expect(sendSpy.mock.calls[0][1]).toBe('')
  })

  it('keeps Send disabled with no text and no attachments', () => {
    const providerId = `fake-${crypto.randomUUID()}`
    providerRegistry.register(makeFakeProvider(providerId, {}))
    setupConversation(conversationId, providerId)

    render(<Composer conversationId={conversationId} />)
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })
})
