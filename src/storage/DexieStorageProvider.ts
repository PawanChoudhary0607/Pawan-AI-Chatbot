import { db } from '@/storage/db'
import type { StorageProvider } from '@/storage/StorageProvider'
import type { Conversation, ConversationMeta } from '@/types/conversation'
import type { ChatMessage } from '@/types/provider'

export class DexieStorageProvider implements StorageProvider {
  readonly backend = 'indexeddb' as const

  async init(): Promise<void> {
    // Opens the DB (and runs any pending version upgrades). Throws if
    // IndexedDB isn't available/usable — caller (storage/index.ts) catches
    // this and falls back to LocalStorageProvider.
    await db.open()
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    const { messages, ...meta } = conversation
    await db.transaction('rw', db.conversations, db.messages, async () => {
      await db.conversations.put(meta)
      if (messages.length > 0) {
        await db.messages.bulkPut(messages.map((m) => ({ ...m, conversationId: conversation.id })))
      }
    })
  }

  async saveConversationMeta(meta: ConversationMeta): Promise<void> {
    await db.conversations.put(meta)
  }

  async saveMessage(conversationId: string, message: ChatMessage): Promise<void> {
    await db.messages.put({ ...message, conversationId })
  }

  async loadConversation(id: string): Promise<Conversation | null> {
    const meta = await db.conversations.get(id)
    if (!meta) return null
    const messages = await db.messages.where('conversationId').equals(id).sortBy('createdAt')
    return { ...meta, messages: messages as ChatMessage[] }
  }

  async loadAllConversations(): Promise<Conversation[]> {
    const metas = await db.conversations.toArray()
    const results: Conversation[] = []
    for (const meta of metas) {
      const messages = await db.messages.where('conversationId').equals(meta.id).sortBy('createdAt')
      results.push({ ...meta, messages: messages as ChatMessage[] })
    }
    return results
  }

  async deleteConversation(id: string): Promise<void> {
    await db.transaction('rw', db.conversations, db.messages, async () => {
      await db.conversations.delete(id)
      await db.messages.where('conversationId').equals(id).delete()
    })
  }

  async saveSetting<T>(key: string, value: T): Promise<void> {
    await db.settings.put({ key, value })
  }

  async loadSetting<T>(key: string): Promise<T | null> {
    const row = await db.settings.get(key)
    return row ? (row.value as T) : null
  }

  async loadAllSettings(): Promise<Record<string, unknown>> {
    const rows = await db.settings.toArray()
    return Object.fromEntries(rows.map((row) => [row.key, row.value]))
  }

  async clearAll(): Promise<void> {
    await db.transaction('rw', db.conversations, db.messages, db.settings, async () => {
      await db.conversations.clear()
      await db.messages.clear()
      await db.settings.clear()
    })
  }
}
