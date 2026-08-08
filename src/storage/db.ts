import Dexie, { type Table } from 'dexie'
import type { ConversationMeta } from '@/types/conversation'
import type { ChatMessage } from '@/types/provider'

/** A message row as stored in Dexie — the domain ChatMessage plus the
 * foreign key needed to query messages by conversation. */
export type MessageRow = ChatMessage & { conversationId: string }

/** A generic key-value row for the settings table (theme, active
 * conversation id, per-provider credentials, UI preferences, etc). Using a
 * single flexible table instead of one column per setting means adding a
 * new setting never requires a schema migration. */
export interface SettingRow {
  key: string
  value: unknown
}

/**
 * App database. Schema is versioned via Dexie's `.version(n).stores(...)`
 * API so future changes are additive and don't break existing users' data.
 *
 * To add a migration later:
 *   this.version(2).stores({
 *     conversations: 'id, updatedAt, pinned, providerId, someNewIndex',
 *   }).upgrade(tx => {
 *     // transform existing rows here if needed
 *   })
 * Never edit the version(1) block below once this ships — add a new
 * version instead, exactly as shown.
 */
export class AppDatabase extends Dexie {
  conversations!: Table<ConversationMeta, string>
  messages!: Table<MessageRow, string>
  settings!: Table<SettingRow, string>

  constructor() {
    super('power-ai-chatbot')

    this.version(1).stores({
      // Primary key first, then indexed fields. `messages` is NOT part of
      // this table — message content lives in its own table, keyed by id
      // and indexed by conversationId, so a conversation rename or a single
      // new message never rewrites the whole message history.
      conversations: 'id, updatedAt, pinned, providerId',
      messages: 'id, conversationId, createdAt',
      settings: 'key',
    })
  }
}

export const db = new AppDatabase()
