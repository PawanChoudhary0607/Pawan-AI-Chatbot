import { beforeEach, describe, expect, it, vi } from 'vitest'

function wait(ms = 20): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Each "session" is a fresh set of module instances (fresh Zustand stores,
 * fresh persistenceService, fresh Dexie connection) but backed by the SAME
 * underlying fake-indexeddb/localStorage — exactly like a real browser
 * refresh, where the JS heap resets but the browser's storage doesn't.
 */
async function freshSession() {
  vi.resetModules()
  const { useConversationStore } = await import('@/state/conversationStore')
  const { useSettingsStore } = await import('@/state/settingsStore')
  const { useAttachmentStore } = await import('@/state/attachmentStore')
  const { persistenceService } = await import('@/storage/persistenceService')
  return { useConversationStore, useSettingsStore, useAttachmentStore, persistenceService }
}

describe('persistenceService (event-driven persistence, end-to-end)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('creates, messages, and renames a conversation, then restores it after a simulated refresh', async () => {
    const session1 = await freshSession()
    await session1.persistenceService.init()

    const id = session1.useConversationStore
      .getState()
      .createConversation('openrouter', 'test-model')
    session1.useConversationStore.getState().appendMessage(id, {
      id: 'm1',
      role: 'user',
      content: 'Hello there',
      status: 'complete',
      createdAt: Date.now(),
    })
    session1.useConversationStore.getState().renameConversation(id, 'My renamed chat')

    // Force debounced writes to run now instead of waiting out the window.
    // @ts-expect-error -- reaching into a private field is fine in a test.
    session1.persistenceService.debouncer.flushAll()
    await wait()

    const session2 = await freshSession()
    await session2.persistenceService.init()

    const restored = session2.useConversationStore.getState().conversations[id]
    expect(restored).toBeDefined()
    expect(restored.title).toBe('My renamed chat')
    expect(restored.messages).toHaveLength(1)
    expect(restored.messages[0].content).toBe('Hello there')
    expect(session2.useConversationStore.getState().activeConversationId).toBe(id)
  })

  it('deletes a conversation and it stays gone after a simulated refresh', async () => {
    const session1 = await freshSession()
    await session1.persistenceService.init()

    const id = session1.useConversationStore
      .getState()
      .createConversation('openrouter', 'test-model')
    await wait()
    session1.useConversationStore.getState().deleteConversation(id)
    await wait()

    const session2 = await freshSession()
    await session2.persistenceService.init()

    expect(session2.useConversationStore.getState().conversations[id]).toBeUndefined()
  })

  it('deleting a conversation also clears its attachment pipeline, revoking any preview blob URLs (Milestone 10A)', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const session = await freshSession()
    await session.persistenceService.init()

    const id = session.useConversationStore
      .getState()
      .createConversation('openrouter', 'test-model')
    const attachment = session.useAttachmentStore
      .getState()
      .add(id, { filename: 'photo.png', mimeType: 'image/png', size: 100 })
    session.useAttachmentStore.getState().markProcessed(id, attachment.id, 'data')
    session.useAttachmentStore.getState().markReady(id, attachment.id, 'blob:preview-1')
    expect(session.useAttachmentStore.getState().snapshots[id]).toHaveLength(1)

    session.useConversationStore.getState().deleteConversation(id)
    await wait()

    expect(session.useAttachmentStore.getState().snapshots[id]).toBeUndefined()
    expect(revokeSpy).toHaveBeenCalledWith('blob:preview-1')
    revokeSpy.mockRestore()
  })

  it('restores theme after a simulated refresh', async () => {
    const session1 = await freshSession()
    await session1.persistenceService.init()

    session1.useSettingsStore.getState().setTheme('light')
    await wait()

    const session2 = await freshSession()
    await session2.persistenceService.init()

    expect(session2.useSettingsStore.getState().theme).toBe('light')
  })

  it('restores one of the new (Milestone 10C) themes after a simulated refresh', async () => {
    const session1 = await freshSession()
    await session1.persistenceService.init()

    session1.useSettingsStore.getState().setTheme('skeuomorphism')
    await wait()

    const session2 = await freshSession()
    await session2.persistenceService.init()

    expect(session2.useSettingsStore.getState().theme).toBe('skeuomorphism')
  })

  it('falls back to "dark" if a corrupted/unrecognized theme value was somehow stored', async () => {
    const session1 = await freshSession()
    await session1.persistenceService.init()
    const { getStorageProvider } = await import('@/storage')
    const storage = await getStorageProvider()
    await storage.saveSetting('theme', 'not-a-real-theme')

    const session2 = await freshSession()
    await session2.persistenceService.init()

    expect(session2.useSettingsStore.getState().theme).toBe('dark')
  })

  it('restores default provider/model settings after a simulated refresh', async () => {
    const session1 = await freshSession()
    await session1.persistenceService.init()

    session1.useSettingsStore.getState().setDefaultProvider('openrouter', 'test-model')
    await wait()

    const session2 = await freshSession()
    await session2.persistenceService.init()

    expect(session2.useSettingsStore.getState().defaultProviderId).toBe('openrouter')
    expect(session2.useSettingsStore.getState().defaultModel).toBe('test-model')
  })

  it('restores per-provider credentials after a simulated refresh', async () => {
    const session1 = await freshSession()
    await session1.persistenceService.init()

    session1.useSettingsStore.getState().setCredentials('openrouter', { apiKey: 'sk-test-123' })
    await wait()

    const session2 = await freshSession()
    await session2.persistenceService.init()

    expect(session2.useSettingsStore.getState().credentials.openrouter).toEqual({
      apiKey: 'sk-test-123',
    })
  })

  it('restores the active conversation selection after a simulated refresh', async () => {
    const session1 = await freshSession()
    await session1.persistenceService.init()

    const idA = session1.useConversationStore.getState().createConversation('openrouter', 'model-a')
    const idB = session1.useConversationStore.getState().createConversation('openrouter', 'model-b')
    session1.useConversationStore.getState().selectConversation(idA)
    await wait()

    const session2 = await freshSession()
    await session2.persistenceService.init()

    expect(session2.useConversationStore.getState().activeConversationId).toBe(idA)
    expect(session2.useConversationStore.getState().conversations[idB]).toBeDefined()
  })
})
