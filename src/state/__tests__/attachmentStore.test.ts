import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAttachmentStore } from '@/state/attachmentStore'

describe('attachmentStore', () => {
  beforeEach(() => {
    useAttachmentStore.setState({ snapshots: {} })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Each test uses fresh, unique conversation ids — the underlying
  // AttachmentPipeline map is module-level (by design, see attachmentStore.ts's
  // comment) and isn't reset between tests, so reusing an id across tests
  // could otherwise trip the pipeline's real duplicate-filename validation
  // from an earlier test's leftover attachment.
  function newConversationId(): string {
    return crypto.randomUUID()
  }

  function addReadyImageAttachment(
    conversationId: string,
    previewUrl: string,
    filename = 'photo.png'
  ) {
    const store = useAttachmentStore.getState()
    const item = store.add(conversationId, { filename, mimeType: 'image/png', size: 100 })
    store.markProcessed(conversationId, item.id, 'base64-data')
    store.markReady(conversationId, item.id, previewUrl)
    return item.id
  }

  it('add() and remove() keep the reactive snapshot in sync', () => {
    const conversationId = newConversationId()
    const id = addReadyImageAttachment(conversationId, 'blob:preview-1')
    expect(useAttachmentStore.getState().snapshots[conversationId]).toHaveLength(1)

    useAttachmentStore.getState().remove(conversationId, id)
    expect(useAttachmentStore.getState().snapshots[conversationId]).toHaveLength(0)
  })

  it('remove() revokes that attachment preview URL', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const conversationId = newConversationId()
    const id = addReadyImageAttachment(conversationId, 'blob:preview-1')

    useAttachmentStore.getState().remove(conversationId, id)

    expect(revokeSpy).toHaveBeenCalledWith('blob:preview-1')
  })

  it('clear() revokes every preview URL for that conversation (this was the confirmed leak: clear() used to bypass pipeline.clear() and just drop the map entry)', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const conversationId = newConversationId()
    addReadyImageAttachment(conversationId, 'blob:preview-a', 'a.png')
    addReadyImageAttachment(conversationId, 'blob:preview-b', 'b.png')

    useAttachmentStore.getState().clear(conversationId)

    expect(revokeSpy).toHaveBeenCalledWith('blob:preview-a')
    expect(revokeSpy).toHaveBeenCalledWith('blob:preview-b')
    expect(useAttachmentStore.getState().snapshots[conversationId]).toBeUndefined()
  })

  it('clear() only revokes URLs for the specified conversation, not others', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const conversationA = newConversationId()
    const conversationB = newConversationId()
    addReadyImageAttachment(conversationA, 'blob:preview-1')
    addReadyImageAttachment(conversationB, 'blob:preview-2')

    useAttachmentStore.getState().clear(conversationA)

    expect(revokeSpy).toHaveBeenCalledWith('blob:preview-1')
    expect(revokeSpy).not.toHaveBeenCalledWith('blob:preview-2')
    expect(useAttachmentStore.getState().snapshots[conversationB]).toHaveLength(1)
  })

  it('clear() on a conversation with no attachments is a safe no-op', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    expect(() => useAttachmentStore.getState().clear(newConversationId())).not.toThrow()
    expect(revokeSpy).not.toHaveBeenCalled()
  })

  it('revokeAllPreviewUrls() revokes across every conversation at once', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const conversationA = newConversationId()
    const conversationB = newConversationId()
    const conversationC = newConversationId()
    addReadyImageAttachment(conversationA, 'blob:preview-1')
    addReadyImageAttachment(conversationB, 'blob:preview-2')
    addReadyImageAttachment(conversationC, 'blob:preview-3')

    useAttachmentStore.getState().revokeAllPreviewUrls()

    expect(revokeSpy).toHaveBeenCalledWith('blob:preview-1')
    expect(revokeSpy).toHaveBeenCalledWith('blob:preview-2')
    expect(revokeSpy).toHaveBeenCalledWith('blob:preview-3')
  })

  it('add() returns the created attachment and reflects it in the snapshot immediately', () => {
    const conversationId = newConversationId()
    const item = useAttachmentStore
      .getState()
      .add(conversationId, { filename: 'doc.pdf', mimeType: 'application/pdf', size: 500 })

    expect(item.filename).toBe('doc.pdf')
    expect(item.processingStatus).toBe('validated') // valid candidate, so queued->validated immediately
    expect(useAttachmentStore.getState().snapshots[conversationId]).toHaveLength(1)
  })

  it('getPipeline() returns the same underlying pipeline instance across calls for one conversation', () => {
    const conversationId = newConversationId()
    const pipelineA = useAttachmentStore.getState().getPipeline(conversationId)
    const pipelineB = useAttachmentStore.getState().getPipeline(conversationId)
    expect(pipelineA).toBe(pipelineB)
  })

  it('markProcessed/markReady/markSent/markCompleted each advance the snapshot through the pipeline', () => {
    const conversationId = newConversationId()
    const store = useAttachmentStore.getState()
    const item = store.add(conversationId, { filename: 'a.png', mimeType: 'image/png', size: 10 })

    store.markProcessed(conversationId, item.id, 'base64data')
    expect(useAttachmentStore.getState().snapshots[conversationId][0].processingStatus).toBe(
      'processed'
    )

    store.markReady(conversationId, item.id)
    expect(useAttachmentStore.getState().snapshots[conversationId][0].processingStatus).toBe(
      'ready'
    )

    store.markSent(conversationId, item.id)
    expect(useAttachmentStore.getState().snapshots[conversationId][0].processingStatus).toBe('sent')

    store.markCompleted(conversationId, item.id)
    expect(useAttachmentStore.getState().snapshots[conversationId][0].processingStatus).toBe(
      'completed'
    )
  })

  it('markFailed records the error and reaches a terminal failed state', () => {
    const conversationId = newConversationId()
    const store = useAttachmentStore.getState()
    const item = store.add(conversationId, { filename: 'a.png', mimeType: 'image/png', size: 10 })

    store.markFailed(conversationId, item.id, 'Upload rejected')

    const snapshot = useAttachmentStore.getState().snapshots[conversationId][0]
    expect(snapshot.processingStatus).toBe('failed')
    expect(snapshot.error).toBe('Upload rejected')
  })

  it('markFailed on a ready image attachment also leaves its preview URL to be cleaned up by clear(), not silently dropped', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const conversationId = newConversationId()
    const id = addReadyImageAttachment(conversationId, 'blob:preview-failed')

    useAttachmentStore.getState().markFailed(conversationId, id, 'Provider rejected the file')
    useAttachmentStore.getState().clear(conversationId)

    expect(revokeSpy).toHaveBeenCalledWith('blob:preview-failed')
  })
})
