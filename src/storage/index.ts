import { DexieStorageProvider } from '@/storage/DexieStorageProvider'
import { LocalStorageProvider } from '@/storage/LocalStorageProvider'
import type { StorageProvider } from '@/storage/StorageProvider'

let cachedProvider: Promise<StorageProvider> | null = null

async function createStorageProvider(): Promise<StorageProvider> {
  const dexieProvider = new DexieStorageProvider()
  try {
    await dexieProvider.init()
    return dexieProvider
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[storage] IndexedDB unavailable or failed to open — falling back to localStorage.',
      err
    )
  }

  try {
    const fallback = new LocalStorageProvider()
    await fallback.init()
    return fallback
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      '[storage] localStorage is also unavailable — the app will run in-memory only for this session.',
      err
    )
    // Last resort: an in-memory no-op provider so the app never crashes,
    // it just won't persist anything this session.
    return createInMemoryFallbackProvider()
  }
}

function createInMemoryFallbackProvider(): StorageProvider {
  const conversations = new Map<string, import('@/types/conversation').Conversation>()
  const settings = new Map<string, unknown>()

  return {
    backend: 'localstorage',
    async init() {},
    async saveConversation(conversation) {
      conversations.set(conversation.id, conversation)
    },
    async saveConversationMeta(meta) {
      const existing = conversations.get(meta.id)
      conversations.set(meta.id, { ...meta, messages: existing?.messages ?? [] })
    },
    async saveMessage(conversationId, message) {
      const existing = conversations.get(conversationId)
      if (!existing) return
      const idx = existing.messages.findIndex((m) => m.id === message.id)
      if (idx >= 0) existing.messages[idx] = message
      else existing.messages.push(message)
    },
    async loadConversation(id) {
      return conversations.get(id) ?? null
    },
    async loadAllConversations() {
      return Array.from(conversations.values())
    },
    async deleteConversation(id) {
      conversations.delete(id)
    },
    async saveSetting(key, value) {
      settings.set(key, value)
    },
    async loadSetting(key) {
      return (settings.get(key) as never) ?? null
    },
    async loadAllSettings() {
      return Object.fromEntries(settings.entries())
    },
    async clearAll() {
      conversations.clear()
      settings.clear()
    },
  }
}

/** The single entry point the rest of the app (persistenceService only)
 * uses to get a ready storage backend. Memoized so we only ever
 * probe/initialize once per session. */
export function getStorageProvider(): Promise<StorageProvider> {
  if (!cachedProvider) {
    cachedProvider = createStorageProvider()
  }
  return cachedProvider
}
