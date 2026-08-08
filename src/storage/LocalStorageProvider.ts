import type { StorageProvider } from '@/storage/StorageProvider'
import type { Conversation, ConversationMeta } from '@/types/conversation'
import type { ChatMessage } from '@/types/provider'

const NS = 'pac' // power-ai-chatbot namespace, kept short since localStorage has size limits
const CONVERSATION_INDEX_KEY = `${NS}:conversations:index`
const conversationMetaKey = (id: string) => `${NS}:conversation:${id}:meta`
const conversationMessagesKey = (id: string) => `${NS}:conversation:${id}:messages`
const settingKey = (key: string) => `${NS}:setting:${key}`

/**
 * localStorage has no indices or transactions, so this implementation keeps
 * a small JSON "index" array of conversation ids and stores each
 * conversation's metadata and message list under separate keys. It's less
 * efficient than IndexedDB but keeps the app fully usable when IndexedDB is
 * unavailable (private browsing modes, some embedded webviews, storage
 * quota issues, etc).
 */
export class LocalStorageProvider implements StorageProvider {
  readonly backend = 'localstorage' as const

  async init(): Promise<void> {
    // Throws (caught by storage/index.ts) if localStorage itself is
    // unusable — at that point the app runs in-memory only for the session.
    const testKey = `${NS}:__probe__`
    window.localStorage.setItem(testKey, '1')
    window.localStorage.removeItem(testKey)
    if (!window.localStorage.getItem(CONVERSATION_INDEX_KEY)) {
      window.localStorage.setItem(CONVERSATION_INDEX_KEY, JSON.stringify([]))
    }
  }

  private getIndex(): string[] {
    const raw = window.localStorage.getItem(CONVERSATION_INDEX_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  }

  private setIndex(ids: string[]): void {
    window.localStorage.setItem(CONVERSATION_INDEX_KEY, JSON.stringify(ids))
  }

  private addToIndex(id: string): void {
    const index = this.getIndex()
    if (!index.includes(id)) {
      this.setIndex([...index, id])
    }
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    const { messages, ...meta } = conversation
    window.localStorage.setItem(conversationMetaKey(conversation.id), JSON.stringify(meta))
    window.localStorage.setItem(conversationMessagesKey(conversation.id), JSON.stringify(messages))
    this.addToIndex(conversation.id)
  }

  async saveConversationMeta(meta: ConversationMeta): Promise<void> {
    window.localStorage.setItem(conversationMetaKey(meta.id), JSON.stringify(meta))
    this.addToIndex(meta.id)
  }

  async saveMessage(conversationId: string, message: ChatMessage): Promise<void> {
    const raw = window.localStorage.getItem(conversationMessagesKey(conversationId))
    const messages: ChatMessage[] = raw ? JSON.parse(raw) : []
    const idx = messages.findIndex((m) => m.id === message.id)
    if (idx >= 0) {
      messages[idx] = message
    } else {
      messages.push(message)
    }
    window.localStorage.setItem(conversationMessagesKey(conversationId), JSON.stringify(messages))
  }

  async loadConversation(id: string): Promise<Conversation | null> {
    const metaRaw = window.localStorage.getItem(conversationMetaKey(id))
    if (!metaRaw) return null
    const meta = JSON.parse(metaRaw) as ConversationMeta
    const messagesRaw = window.localStorage.getItem(conversationMessagesKey(id))
    const messages: ChatMessage[] = messagesRaw ? JSON.parse(messagesRaw) : []
    return { ...meta, messages }
  }

  async loadAllConversations(): Promise<Conversation[]> {
    const ids = this.getIndex()
    const results: Conversation[] = []
    for (const id of ids) {
      const conversation = await this.loadConversation(id)
      if (conversation) results.push(conversation)
    }
    return results
  }

  async deleteConversation(id: string): Promise<void> {
    window.localStorage.removeItem(conversationMetaKey(id))
    window.localStorage.removeItem(conversationMessagesKey(id))
    this.setIndex(this.getIndex().filter((existingId) => existingId !== id))
  }

  async saveSetting<T>(key: string, value: T): Promise<void> {
    window.localStorage.setItem(settingKey(key), JSON.stringify(value))
  }

  async loadSetting<T>(key: string): Promise<T | null> {
    const raw = window.localStorage.getItem(settingKey(key))
    return raw ? (JSON.parse(raw) as T) : null
  }

  async loadAllSettings(): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {}
    const prefix = `${NS}:setting:`
    for (let i = 0; i < window.localStorage.length; i++) {
      const storageKey = window.localStorage.key(i)
      if (storageKey && storageKey.startsWith(prefix)) {
        const raw = window.localStorage.getItem(storageKey)
        if (raw !== null) {
          result[storageKey.slice(prefix.length)] = JSON.parse(raw)
        }
      }
    }
    return result
  }

  async clearAll(): Promise<void> {
    const keysToRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const storageKey = window.localStorage.key(i)
      if (storageKey && storageKey.startsWith(`${NS}:`)) {
        keysToRemove.push(storageKey)
      }
    }
    keysToRemove.forEach((key) => window.localStorage.removeItem(key))
    window.localStorage.setItem(CONVERSATION_INDEX_KEY, JSON.stringify([]))
  }
}
