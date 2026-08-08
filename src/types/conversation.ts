import type { ChatMessage } from './provider'

export interface Conversation {
  id: string
  title: string
  providerId: string
  model: string
  systemPrompt?: string
  temperature: number
  topP: number
  maxTokens?: number
  pinned: boolean
  /** Archived conversations are hidden from the main list but not deleted —
   * restorable at any time. */
  archived: boolean
  /** null/undefined = unfiled. References ConversationFolder.id. */
  folderId?: string | null
  /** null/undefined = not part of a project. References Project.id. */
  projectId?: string | null
  /** Bumped every time the conversation is selected — drives the
   * "Recently opened" sort mode without needing a separate tracked list. */
  lastOpenedAt: number
  messages: ChatMessage[]
  /**
   * Open-ended bag for forward-compatible, non-schema-critical data (e.g. a
   * future "last used tool" or UI hint) so new fields don't require a type
   * change + Dexie migration every time. Prefer a typed field above for
   * anything that needs real type safety or querying.
   */
  metadata?: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

/**
 * A Conversation without its messages — what the storage layer writes/reads
 * cheaply on every metadata change (rename, pin, provider switch) without
 * touching the (potentially large) message list.
 */
export type ConversationMeta = Omit<Conversation, 'messages'>

/** A user-defined grouping for conversations. Deliberately flat (no nested
 * folders) — kept simple for this milestone. Persisted generically via the
 * existing settings key-value store, not a new Dexie table. */
export interface ConversationFolder {
  id: string
  name: string
  createdAt: number
}

export type ConversationSortMode = 'updatedAt' | 'lastOpenedAt' | 'title' | 'createdAt'
