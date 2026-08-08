import type { ChatMessage } from './provider'

/**
 * All application-level events. Any module can publish or subscribe without
 * importing the modules on the other side — this is what keeps the chat
 * pipeline, sidebar, persistence layer, and future features decoupled.
 *
 * Naming convention: "<domain>.<lifecycle event>".
 */
export interface AppEventMap {
  'conversation.created': { conversationId: string }
  'conversation.selected': { conversationId: string }
  'conversation.renamed': { conversationId: string; title: string }
  'conversation.deleted': { conversationId: string }
  'conversation.pinned': { conversationId: string; pinned: boolean }
  'conversation.archived': { conversationId: string; archived: boolean }
  'conversation.folderChanged': { conversationId: string; folderId: string | null }
  'conversation.projectChanged': { conversationId: string; projectId: string | null }

  'message.sent': { conversationId: string; message: ChatMessage }
  'message.received': { conversationId: string; message: ChatMessage }
  'message.updated': { conversationId: string; messageId: string }

  'stream.started': { conversationId: string; messageId: string }
  'stream.chunk': { conversationId: string; messageId: string; textDelta?: string }
  'stream.completed': { conversationId: string; messageId: string }
  'stream.error': { conversationId: string; messageId: string; error: string }
  'stream.stopped': { conversationId: string; messageId: string }

  'provider.changed': { conversationId: string; providerId: string; model: string }
  'provider.keyValidated': { providerId: string }
  'provider.keyInvalid': { providerId: string; message?: string }

  'settings.updated': { key: string }
  'theme.changed': { theme: import('@/state/settingsStore').AppTheme }
}

export type AppEventName = keyof AppEventMap
