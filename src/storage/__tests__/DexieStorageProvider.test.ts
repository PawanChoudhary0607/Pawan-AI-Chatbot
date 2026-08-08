import { beforeEach, describe, expect, it } from 'vitest'
import { DexieStorageProvider } from '@/storage/DexieStorageProvider'
import { db } from '@/storage/db'
import type { Conversation } from '@/types/conversation'

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    title: 'Test conversation',
    providerId: 'openrouter',
    model: 'test-model',
    temperature: 0.7,
    topP: 1,
    pinned: false,
    archived: false,
    lastOpenedAt: now,
    messages: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('DexieStorageProvider', () => {
  let storage: DexieStorageProvider

  beforeEach(async () => {
    // Fresh DB per test so tests don't leak state into each other.
    if (db.isOpen()) db.close()
    await db.delete()
    storage = new DexieStorageProvider()
    await storage.init()
  })

  it('creates and loads a conversation with its messages', async () => {
    const conversation = makeConversation({
      messages: [
        { id: 'm1', role: 'user', content: 'Hello', status: 'complete', createdAt: Date.now() },
      ],
    })

    await storage.saveConversation(conversation)
    const loaded = await storage.loadConversation(conversation.id)

    expect(loaded).not.toBeNull()
    expect(loaded?.title).toBe('Test conversation')
    expect(loaded?.messages).toHaveLength(1)
    expect(loaded?.messages[0].content).toBe('Hello')
  })

  it('renames a conversation via metadata-only write without touching messages', async () => {
    const conversation = makeConversation({
      messages: [
        { id: 'm1', role: 'user', content: 'Hi', status: 'complete', createdAt: Date.now() },
      ],
    })
    await storage.saveConversation(conversation)

    const meta: Partial<Conversation> = { ...conversation }
    delete meta.messages
    await storage.saveConversationMeta({
      ...(meta as Omit<Conversation, 'messages'>),
      title: 'Renamed conversation',
    })

    const loaded = await storage.loadConversation(conversation.id)
    expect(loaded?.title).toBe('Renamed conversation')
    expect(loaded?.messages).toHaveLength(1) // untouched
  })

  it('deletes a conversation and its messages', async () => {
    const conversation = makeConversation({
      messages: [
        { id: 'm1', role: 'user', content: 'Hi', status: 'complete', createdAt: Date.now() },
      ],
    })
    await storage.saveConversation(conversation)

    await storage.deleteConversation(conversation.id)

    const loaded = await storage.loadConversation(conversation.id)
    expect(loaded).toBeNull()
    const messageCount = await db.messages.where('conversationId').equals(conversation.id).count()
    expect(messageCount).toBe(0)
  })

  it('saves and loads settings independently of conversations', async () => {
    await storage.saveSetting('theme', 'light')
    await storage.saveSetting('activeConversationId', 'abc-123')

    expect(await storage.loadSetting('theme')).toBe('light')
    expect(await storage.loadSetting('activeConversationId')).toBe('abc-123')

    const all = await storage.loadAllSettings()
    expect(all).toMatchObject({ theme: 'light', activeConversationId: 'abc-123' })
  })

  it('clearAll wipes conversations, messages, and settings', async () => {
    await storage.saveConversation(makeConversation())
    await storage.saveSetting('theme', 'dark')

    await storage.clearAll()

    expect(await storage.loadAllConversations()).toHaveLength(0)
    expect(await storage.loadAllSettings()).toEqual({})
  })

  it('survives a simulated app restart (new provider instance, same underlying DB)', async () => {
    const conversation = makeConversation({ title: 'Persisted across restart' })
    await storage.saveConversation(conversation)
    await storage.saveSetting('theme', 'light')

    // Simulate "close the app" by closing the connection, then "reopen the
    // app" with a brand new provider instance against the same DB name.
    db.close()
    const restarted = new DexieStorageProvider()
    await restarted.init()

    const restored = await restarted.loadConversation(conversation.id)
    expect(restored?.title).toBe('Persisted across restart')
    expect(await restarted.loadSetting('theme')).toBe('light')
  })
})
