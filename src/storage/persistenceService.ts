import { eventBus } from '@/events/eventBus'
import { KeyedDebouncer } from '@/lib/keyedDebouncer'
import { getStorageProvider } from '@/storage'
import type { StorageProvider } from '@/storage/StorageProvider'
import { useConversationStore } from '@/state/conversationStore'
import { useSettingsStore } from '@/state/settingsStore'
import type { AppTheme } from '@/state/settingsStore'
import { usePromptStore } from '@/state/promptStore'
import { useProjectStore } from '@/state/projectStore'
import { useAttachmentStore } from '@/state/attachmentStore'
import type { Conversation, ConversationFolder } from '@/types/conversation'

// Debounce windows. Message writes are debounced more aggressively because
// a future streaming flow (Milestone 3+) will emit `message.updated`
// repeatedly as tokens arrive — we never want a DB write per token.
const MESSAGE_WRITE_DEBOUNCE_MS = 400
const CONVERSATION_META_DEBOUNCE_MS = 300

function toMeta(conversation: Conversation) {
  const meta: Partial<Conversation> = { ...conversation }
  delete meta.messages
  return meta as import('@/types/conversation').ConversationMeta
}

const KNOWN_THEMES: readonly AppTheme[] = [
  'light',
  'dark',
  'minimal',
  'neumorphism',
  'skeuomorphism',
]
function isKnownTheme(value: unknown): value is AppTheme {
  return typeof value === 'string' && (KNOWN_THEMES as readonly string[]).includes(value)
}

class PersistenceService {
  private storage: StorageProvider | null = null
  private debouncer = new KeyedDebouncer()
  private unsubscribers: Array<() => void> = []
  private initialized = false

  /** Call once at app startup, before rendering. Never throws — any
   * failure here means the app simply runs in-memory for the session. */
  async init(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

    try {
      this.storage = await getStorageProvider()
      await this.hydrateStores(this.storage)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        '[persistence] Failed to initialize or hydrate storage. Continuing with empty in-memory state.',
        err
      )
      this.storage = null
    }

    this.wireEvents()

    // Make sure nothing sitting in a debounce window is lost if the tab
    // closes right after an edit.
    window.addEventListener('beforeunload', () => this.debouncer.flushAll())
  }

  private async hydrateStores(storage: StorageProvider): Promise<void> {
    const [conversationsList, settings] = await Promise.all([
      storage.loadAllConversations(),
      storage.loadAllSettings(),
    ])

    const conversations = Object.fromEntries(conversationsList.map((c) => [c.id, c]))
    const activeConversationId = (settings.activeConversationId as string | undefined) ?? null
    useConversationStore
      .getState()
      .hydrate(
        conversations,
        activeConversationId && conversations[activeConversationId] ? activeConversationId : null
      )

    useSettingsStore.getState().hydrate({
      theme: isKnownTheme(settings.theme) ? settings.theme : 'dark',
      defaultProviderId: (settings.defaultProviderId as string | undefined) ?? null,
      defaultModel: (settings.defaultModel as string | undefined) ?? null,
      credentials: (settings.credentials as Record<string, never> | undefined) ?? {},
      uiPreferences: (settings.uiPreferences as Record<string, unknown> | undefined) ?? {},
    })

    useConversationStore
      .getState()
      .hydrateFolders((settings.folders as Record<string, ConversationFolder> | undefined) ?? {})
    usePromptStore
      .getState()
      .hydrate((settings.prompts as import('@/types/prompt').SavedPrompt[] | undefined) ?? [])

    useProjectStore
      .getState()
      .hydrate(
        (settings.projects as Record<string, import('@/types/project').Project> | undefined) ?? {},
        (settings.activeProjectId as string | undefined) ?? null
      )
  }

  private wireEvents(): void {
    const on = eventBus.on.bind(eventBus)

    this.unsubscribers.push(
      // Conversation lifecycle — metadata writes only, debounced.
      on('conversation.created', ({ conversationId }) => this.saveFullConversation(conversationId)),
      on('conversation.renamed', ({ conversationId }) =>
        this.saveConversationMetaDebounced(conversationId)
      ),
      on('conversation.pinned', ({ conversationId }) =>
        this.saveConversationMetaDebounced(conversationId)
      ),
      on('conversation.archived', ({ conversationId }) =>
        this.saveConversationMetaDebounced(conversationId)
      ),
      on('conversation.folderChanged', ({ conversationId }) =>
        this.saveConversationMetaDebounced(conversationId)
      ),
      on('conversation.projectChanged', ({ conversationId }) =>
        this.saveConversationMetaDebounced(conversationId)
      ),
      on('provider.changed', ({ conversationId }) =>
        this.saveConversationMetaDebounced(conversationId)
      ),
      on('conversation.deleted', ({ conversationId }) => {
        this.deleteConversation(conversationId)
        // Also tears down that conversation's in-memory attachment
        // pipeline, revoking any preview blob URLs it was still holding —
        // without this, deleting a conversation that had pending or
        // recently-sent image attachments leaked their blob URLs forever.
        useAttachmentStore.getState().clear(conversationId)
      }),
      on('conversation.selected', ({ conversationId }) => {
        this.saveSetting('activeConversationId', conversationId)
        // Selecting also bumps lastOpenedAt (see conversationStore) — debounced
        // like any other metadata touch, harmless if the user is just
        // clicking through conversations quickly.
        this.saveConversationMetaDebounced(conversationId)
      }),

      // Messages — debounced per message id, flushed immediately when a
      // stream settles. Conversation meta is also touched (debounced) so
      // `updatedAt` stays accurate for restored sort order.
      on('message.sent', ({ conversationId, message }) => {
        this.saveMessageDebounced(conversationId, message.id)
        this.saveConversationMetaDebounced(conversationId)
      }),
      on('message.received', ({ conversationId, message }) => {
        this.saveMessageDebounced(conversationId, message.id)
        this.saveConversationMetaDebounced(conversationId)
      }),
      on('message.updated', ({ conversationId, messageId }) =>
        this.saveMessageDebounced(conversationId, messageId)
      ),
      on('stream.completed', ({ conversationId, messageId }) =>
        this.flushMessage(conversationId, messageId)
      ),
      on('stream.error', ({ conversationId, messageId }) =>
        this.flushMessage(conversationId, messageId)
      ),
      on('stream.stopped', ({ conversationId, messageId }) =>
        this.flushMessage(conversationId, messageId)
      ),

      // Settings + theme — small, infrequent writes; no debounce needed but
      // harmless to keep consistent.
      on('settings.updated', ({ key }) => this.persistSettingsKey(key)),
      on('theme.changed', ({ theme }) => this.saveSetting('theme', theme))
    )
  }

  private saveFullConversation(conversationId: string): void {
    if (!this.storage) return
    const conversation = useConversationStore.getState().conversations[conversationId]
    if (!conversation) return
    this.storage
      .saveConversation(conversation)
      .catch((err) => this.logWriteError('saveConversation', err))
  }

  private saveConversationMetaDebounced(conversationId: string): void {
    if (!this.storage) return
    this.debouncer.schedule(
      `conversation-meta:${conversationId}`,
      () => {
        const conversation = useConversationStore.getState().conversations[conversationId]
        if (!conversation || !this.storage) return
        this.storage
          .saveConversationMeta(toMeta(conversation))
          .catch((err) => this.logWriteError('saveConversationMeta', err))
      },
      CONVERSATION_META_DEBOUNCE_MS
    )
  }

  private saveMessageDebounced(conversationId: string, messageId: string): void {
    if (!this.storage) return
    this.debouncer.schedule(
      `message:${messageId}`,
      () => {
        const conversation = useConversationStore.getState().conversations[conversationId]
        const message = conversation?.messages.find((m) => m.id === messageId)
        if (!message || !this.storage) return
        this.storage
          .saveMessage(conversationId, message)
          .catch((err) => this.logWriteError('saveMessage', err))
      },
      MESSAGE_WRITE_DEBOUNCE_MS
    )
  }

  private flushMessage(_conversationId: string, messageId: string): void {
    this.debouncer.flush(`message:${messageId}`)
  }

  private deleteConversation(conversationId: string): void {
    if (!this.storage) return
    // Cancel any in-flight debounced writes for this conversation's
    // messages/meta so a delete can't be "undone" by a stale write landing
    // afterward.
    this.debouncer.cancel(`conversation-meta:${conversationId}`)
    this.storage
      .deleteConversation(conversationId)
      .catch((err) => this.logWriteError('deleteConversation', err))
  }

  private persistSettingsKey(key: string): void {
    if (!this.storage) return
    const state = useSettingsStore.getState()

    if (key === 'defaultProvider') {
      this.saveSetting('defaultProviderId', state.defaultProviderId)
      this.saveSetting('defaultModel', state.defaultModel)
      return
    }
    if (key.startsWith('credentials:')) {
      this.saveSetting('credentials', state.credentials)
      return
    }
    if (key.startsWith('uiPreference:')) {
      this.saveSetting('uiPreferences', state.uiPreferences)
      return
    }
    if (key === 'folders') {
      this.saveSetting('folders', useConversationStore.getState().folders)
      return
    }
    if (key === 'projects') {
      this.saveSetting('projects', useProjectStore.getState().projects)
      return
    }
    if (key === 'activeProjectId') {
      this.saveSetting('activeProjectId', useProjectStore.getState().activeProjectId)
      return
    }
    if (key === 'prompts') {
      this.saveSetting('prompts', usePromptStore.getState().prompts)
      return
    }
  }

  private saveSetting(key: string, value: unknown): void {
    if (!this.storage) return
    this.storage.saveSetting(key, value).catch((err) => this.logWriteError('saveSetting', err))
  }

  private logWriteError(operation: string, err: unknown): void {
    // Storage failures must never break the chat experience — log and move
    // on. The in-memory store already has the authoritative current state.
    // eslint-disable-next-line no-console
    console.error(
      `[persistence] "${operation}" failed. Chat will continue; this write was lost.`,
      err
    )
  }

  /** Exposed for a future "clear my data" settings action. */
  async clearAll(): Promise<void> {
    if (!this.storage) return
    await this.storage.clearAll()
  }

  dispose(): void {
    this.unsubscribers.forEach((unsub) => unsub())
    this.unsubscribers = []
  }
}

export const persistenceService = new PersistenceService()
