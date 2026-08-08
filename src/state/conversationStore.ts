import { create } from 'zustand'
import { eventBus } from '@/events/eventBus'
import type { Conversation, ConversationFolder } from '@/types/conversation'
import type { ChatMessage } from '@/types/provider'

function makeId(): string {
  return crypto.randomUUID()
}

export interface CreateConversationOptions {
  projectId?: string | null
  systemPrompt?: string
}

export interface ConversationState {
  conversations: Record<string, Conversation>
  activeConversationId: string | null
  folders: Record<string, ConversationFolder>

  /** Populates state from storage at app startup. Does NOT emit events —
   * this is a restore, not a user action, and must not trigger the
   * persistence layer to write straight back what it just read. */
  hydrate: (
    conversations: Record<string, Conversation>,
    activeConversationId: string | null
  ) => void
  hydrateFolders: (folders: Record<string, ConversationFolder>) => void

  createConversation: (
    providerId: string,
    model: string,
    options?: CreateConversationOptions
  ) => string
  selectConversation: (id: string) => void
  renameConversation: (id: string, title: string) => void
  deleteConversation: (id: string) => void
  togglePinned: (id: string) => void
  toggleArchived: (id: string) => void
  setConversationFolder: (id: string, folderId: string | null) => void
  setConversationProject: (id: string, projectId: string | null) => void
  appendMessage: (conversationId: string, message: ChatMessage) => void
  /** Patches an existing message (used for streaming content updates and
   * status transitions). Emits 'message.updated' so persistence picks it up
   * via its existing debounced write path. */
  updateMessage: (conversationId: string, messageId: string, patch: Partial<ChatMessage>) => void
  updateConversationProvider: (id: string, providerId: string, model: string) => void

  /** Creates a new conversation containing the source's messages up to and
   * including `fromMessageId`, preserving provider/model/instructions/
   * project. The two histories are independent after this point — later
   * messages in either conversation don't affect the other. Also used to
   * implement "Continue from any message". */
  branchConversation: (sourceConversationId: string, fromMessageId: string) => string | null
  /** Creates a full, independent copy of a conversation (all messages). */
  duplicateConversation: (sourceConversationId: string) => string | null

  createFolder: (name: string) => string
  renameFolder: (id: string, name: string) => void
  deleteFolder: (id: string) => void
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: {},
  activeConversationId: null,
  folders: {},

  hydrate: (conversations, activeConversationId) => {
    set({ conversations, activeConversationId })
  },

  hydrateFolders: (folders) => {
    set({ folders })
  },

  createConversation: (providerId, model, options) => {
    const id = makeId()
    const now = Date.now()
    const conversation: Conversation = {
      id,
      title: 'New conversation',
      providerId,
      model,
      systemPrompt: options?.systemPrompt,
      temperature: 0.7,
      topP: 1,
      pinned: false,
      archived: false,
      folderId: null,
      projectId: options?.projectId ?? null,
      lastOpenedAt: now,
      messages: [],
      createdAt: now,
      updatedAt: now,
    }
    set((state) => ({
      conversations: { ...state.conversations, [id]: conversation },
      activeConversationId: id,
    }))
    eventBus.emit('conversation.created', { conversationId: id })
    eventBus.emit('conversation.selected', { conversationId: id })
    return id
  },

  selectConversation: (id) => {
    if (!get().conversations[id]) return
    set((state) => ({
      activeConversationId: id,
      conversations: {
        ...state.conversations,
        [id]: { ...state.conversations[id], lastOpenedAt: Date.now() },
      },
    }))
    eventBus.emit('conversation.selected', { conversationId: id })
  },

  renameConversation: (id, title) => {
    set((state) => {
      const existing = state.conversations[id]
      if (!existing) return state
      return {
        conversations: {
          ...state.conversations,
          [id]: { ...existing, title, updatedAt: Date.now() },
        },
      }
    })
    eventBus.emit('conversation.renamed', { conversationId: id, title })
  },

  deleteConversation: (id) => {
    set((state) => {
      const next = { ...state.conversations }
      delete next[id]
      const nextActive = state.activeConversationId === id ? null : state.activeConversationId
      return { conversations: next, activeConversationId: nextActive }
    })
    eventBus.emit('conversation.deleted', { conversationId: id })
  },

  togglePinned: (id) => {
    set((state) => {
      const existing = state.conversations[id]
      if (!existing) return state
      return {
        conversations: {
          ...state.conversations,
          [id]: { ...existing, pinned: !existing.pinned },
        },
      }
    })
    const pinned = get().conversations[id]?.pinned ?? false
    eventBus.emit('conversation.pinned', { conversationId: id, pinned })
  },

  toggleArchived: (id) => {
    set((state) => {
      const existing = state.conversations[id]
      if (!existing) return state
      return {
        conversations: {
          ...state.conversations,
          [id]: { ...existing, archived: !existing.archived },
        },
      }
    })
    const archived = get().conversations[id]?.archived ?? false
    eventBus.emit('conversation.archived', { conversationId: id, archived })
  },

  setConversationFolder: (id, folderId) => {
    set((state) => {
      const existing = state.conversations[id]
      if (!existing) return state
      return {
        conversations: {
          ...state.conversations,
          [id]: { ...existing, folderId, updatedAt: Date.now() },
        },
      }
    })
    eventBus.emit('conversation.folderChanged', { conversationId: id, folderId })
  },

  setConversationProject: (id, projectId) => {
    set((state) => {
      const existing = state.conversations[id]
      if (!existing) return state
      return {
        conversations: {
          ...state.conversations,
          [id]: { ...existing, projectId, updatedAt: Date.now() },
        },
      }
    })
    eventBus.emit('conversation.projectChanged', { conversationId: id, projectId })
  },

  appendMessage: (conversationId, message) => {
    set((state) => {
      const existing = state.conversations[conversationId]
      if (!existing) return state
      return {
        conversations: {
          ...state.conversations,
          [conversationId]: {
            ...existing,
            messages: [...existing.messages, message],
            updatedAt: Date.now(),
          },
        },
      }
    })
    const eventName = message.role === 'user' ? 'message.sent' : 'message.received'
    eventBus.emit(eventName, { conversationId, message })
  },

  updateMessage: (conversationId, messageId, patch) => {
    set((state) => {
      const existing = state.conversations[conversationId]
      if (!existing) return state
      const messages = existing.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m))
      return {
        conversations: {
          ...state.conversations,
          [conversationId]: { ...existing, messages, updatedAt: Date.now() },
        },
      }
    })
    eventBus.emit('message.updated', { conversationId, messageId })
  },

  updateConversationProvider: (id, providerId, model) => {
    set((state) => {
      const existing = state.conversations[id]
      if (!existing) return state
      return {
        conversations: {
          ...state.conversations,
          [id]: { ...existing, providerId, model, updatedAt: Date.now() },
        },
      }
    })
    eventBus.emit('provider.changed', { conversationId: id, providerId, model })
  },

  branchConversation: (sourceConversationId, fromMessageId) => {
    const source = get().conversations[sourceConversationId]
    if (!source) return null
    const cutIndex = source.messages.findIndex((m) => m.id === fromMessageId)
    if (cutIndex === -1) return null

    const id = makeId()
    const now = Date.now()
    const branched: Conversation = {
      ...source,
      id,
      title: `${source.title} (branch)`,
      pinned: false,
      archived: false,
      lastOpenedAt: now,
      // Deep-ish copy: each message gets a new id so persistence treats
      // them as distinct rows, but the content/role/status are preserved.
      messages: source.messages.slice(0, cutIndex + 1).map((m) => ({ ...m, id: makeId() })),
      createdAt: now,
      updatedAt: now,
    }
    set((state) => ({
      conversations: { ...state.conversations, [id]: branched },
      activeConversationId: id,
    }))
    eventBus.emit('conversation.created', { conversationId: id })
    eventBus.emit('conversation.selected', { conversationId: id })
    return id
  },

  duplicateConversation: (sourceConversationId) => {
    const source = get().conversations[sourceConversationId]
    if (!source) return null

    const id = makeId()
    const now = Date.now()
    const duplicated: Conversation = {
      ...source,
      id,
      title: `${source.title} (copy)`,
      pinned: false,
      archived: false,
      lastOpenedAt: now,
      messages: source.messages.map((m) => ({ ...m, id: makeId() })),
      createdAt: now,
      updatedAt: now,
    }
    set((state) => ({
      conversations: { ...state.conversations, [id]: duplicated },
      activeConversationId: id,
    }))
    eventBus.emit('conversation.created', { conversationId: id })
    eventBus.emit('conversation.selected', { conversationId: id })
    return id
  },

  createFolder: (name) => {
    const id = makeId()
    const folder: ConversationFolder = { id, name, createdAt: Date.now() }
    set((state) => ({ folders: { ...state.folders, [id]: folder } }))
    eventBus.emit('settings.updated', { key: 'folders' })
    return id
  },

  renameFolder: (id, name) => {
    set((state) => {
      const existing = state.folders[id]
      if (!existing) return state
      return { folders: { ...state.folders, [id]: { ...existing, name } } }
    })
    eventBus.emit('settings.updated', { key: 'folders' })
  },

  deleteFolder: (id) => {
    set((state) => {
      const nextFolders = { ...state.folders }
      delete nextFolders[id]
      // Un-assign any conversations that were in this folder rather than
      // leaving them pointing at a folder that no longer exists.
      const nextConversations = Object.fromEntries(
        Object.entries(state.conversations).map(([convId, conv]) => [
          convId,
          conv.folderId === id ? { ...conv, folderId: null } : conv,
        ])
      )
      return { folders: nextFolders, conversations: nextConversations }
    })
    eventBus.emit('settings.updated', { key: 'folders' })
  },
}))
