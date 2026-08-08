import type { Conversation, ConversationMeta } from '@/types/conversation'
import type { ChatMessage } from '@/types/provider'

/**
 * Storage abstraction. React components must NEVER import a StorageProvider
 * implementation or touch IndexedDB/localStorage directly — only
 * `persistenceService` (an event-bus subscriber) and store hydration code
 * talk to this interface.
 *
 * Two implementations exist: DexieStorageProvider (IndexedDB, preferred) and
 * LocalStorageProvider (fallback if IndexedDB is unavailable or fails to
 * open). Both implement this exact contract so the rest of the app never
 * knows or cares which backend is active.
 */
export interface StorageProvider {
  readonly backend: 'indexeddb' | 'localstorage'

  init(): Promise<void>

  /** Writes conversation metadata + full message list. Used for the initial
   * write of a new conversation; not called on every message. */
  saveConversation(conversation: Conversation): Promise<void>
  /** Cheap metadata-only write (rename, pin, provider/model change, etc). */
  saveConversationMeta(meta: ConversationMeta): Promise<void>
  /** Cheap single-message write/upsert — avoids rewriting the whole
   * conversation on every sent/streamed message. */
  saveMessage(conversationId: string, message: ChatMessage): Promise<void>

  loadConversation(id: string): Promise<Conversation | null>
  loadAllConversations(): Promise<Conversation[]>
  deleteConversation(id: string): Promise<void>

  saveSetting<T>(key: string, value: T): Promise<void>
  loadSetting<T>(key: string): Promise<T | null>
  loadAllSettings(): Promise<Record<string, unknown>>

  clearAll(): Promise<void>
}
