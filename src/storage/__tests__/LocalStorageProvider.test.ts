import { beforeEach, describe, expect, it } from 'vitest'
import { LocalStorageProvider } from '@/storage/LocalStorageProvider'
import type { Conversation } from '@/types/conversation'

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    title: 'Local test conversation',
    providerId: 'ollama',
    model: 'llama3',
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

describe('LocalStorageProvider (IndexedDB fallback)', () => {
  let storage: LocalStorageProvider

  beforeEach(async () => {
    window.localStorage.clear()
    storage = new LocalStorageProvider()
    await storage.init()
  })

  it('reports its backend as localstorage so the UI/logs can tell them apart', () => {
    expect(storage.backend).toBe('localstorage')
  })

  it('saves and loads a full conversation', async () => {
    const conversation = makeConversation({
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'Hi from fallback',
          status: 'complete',
          createdAt: Date.now(),
        },
      ],
    })
    await storage.saveConversation(conversation)

    const loaded = await storage.loadConversation(conversation.id)
    expect(loaded?.title).toBe('Local test conversation')
    expect(loaded?.messages).toHaveLength(1)
  })

  it('lists all conversations via the internal index', async () => {
    await storage.saveConversation(makeConversation({ title: 'One' }))
    await storage.saveConversation(makeConversation({ title: 'Two' }))

    const all = await storage.loadAllConversations()
    expect(all.map((c) => c.title).sort()).toEqual(['One', 'Two'])
  })

  it('deletes a conversation and removes it from the index', async () => {
    const conversation = makeConversation()
    await storage.saveConversation(conversation)

    await storage.deleteConversation(conversation.id)

    expect(await storage.loadConversation(conversation.id)).toBeNull()
    expect(await storage.loadAllConversations()).toHaveLength(0)
  })

  it('persists settings independently', async () => {
    await storage.saveSetting('theme', 'light')
    expect(await storage.loadSetting('theme')).toBe('light')
  })

  it('survives a simulated restart (new instance, same underlying localStorage)', async () => {
    const conversation = makeConversation({ title: 'Survives restart' })
    await storage.saveConversation(conversation)

    const restarted = new LocalStorageProvider()
    await restarted.init()

    const restored = await restarted.loadConversation(conversation.id)
    expect(restored?.title).toBe('Survives restart')
  })

  it('clearAll only removes this app\u2019s own keys, not unrelated localStorage entries', async () => {
    window.localStorage.setItem('someOtherApp:setting', 'untouched')
    await storage.saveConversation(makeConversation())
    await storage.saveSetting('theme', 'dark')

    await storage.clearAll()

    expect(await storage.loadAllConversations()).toHaveLength(0)
    expect(window.localStorage.getItem('someOtherApp:setting')).toBe('untouched')
  })
})
