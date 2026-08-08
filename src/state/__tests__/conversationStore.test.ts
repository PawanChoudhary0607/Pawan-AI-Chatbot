import { beforeEach, describe, expect, it } from 'vitest'
import { useConversationStore } from '@/state/conversationStore'
import { eventBus } from '@/events/eventBus'

describe('conversationStore — management actions', () => {
  beforeEach(() => {
    useConversationStore.setState({ conversations: {}, activeConversationId: null, folders: {} })
  })

  it('renames a conversation and emits conversation.renamed', () => {
    const id = useConversationStore.getState().createConversation('openrouter', 'test-model')
    const seen: string[] = []
    const unsub = eventBus.on('conversation.renamed', ({ title }) => seen.push(title))

    useConversationStore.getState().renameConversation(id, 'My renamed chat')

    expect(useConversationStore.getState().conversations[id].title).toBe('My renamed chat')
    expect(seen).toEqual(['My renamed chat'])
    unsub()
  })

  it('archives a conversation and emits conversation.archived with archived:true', () => {
    const id = useConversationStore.getState().createConversation('openrouter', 'test-model')
    const seen: boolean[] = []
    const unsub = eventBus.on('conversation.archived', ({ archived }) => seen.push(archived))

    useConversationStore.getState().toggleArchived(id)

    expect(useConversationStore.getState().conversations[id].archived).toBe(true)
    expect(seen).toEqual([true])
    unsub()
  })

  it('restores an archived conversation (toggleArchived again) with archived:false', () => {
    const id = useConversationStore.getState().createConversation('openrouter', 'test-model')
    useConversationStore.getState().toggleArchived(id) // archive
    const seen: boolean[] = []
    const unsub = eventBus.on('conversation.archived', ({ archived }) => seen.push(archived))

    useConversationStore.getState().toggleArchived(id) // restore

    expect(useConversationStore.getState().conversations[id].archived).toBe(false)
    expect(seen).toEqual([false])
    unsub()
  })

  it('toggles pinned', () => {
    const id = useConversationStore.getState().createConversation('openrouter', 'test-model')
    useConversationStore.getState().togglePinned(id)
    expect(useConversationStore.getState().conversations[id].pinned).toBe(true)
    useConversationStore.getState().togglePinned(id)
    expect(useConversationStore.getState().conversations[id].pinned).toBe(false)
  })

  it('bumps lastOpenedAt when a conversation is selected', async () => {
    const id = useConversationStore.getState().createConversation('openrouter', 'test-model')
    const initialLastOpened = useConversationStore.getState().conversations[id].lastOpenedAt
    await new Promise((resolve) => setTimeout(resolve, 5))

    useConversationStore.getState().selectConversation(id)

    expect(useConversationStore.getState().conversations[id].lastOpenedAt).toBeGreaterThan(
      initialLastOpened
    )
  })

  it('creates a folder, assigns a conversation to it, and emits the expected events', () => {
    const conversationId = useConversationStore
      .getState()
      .createConversation('openrouter', 'test-model')
    const folderEvents: string[] = []
    const unsub = eventBus.on('settings.updated', ({ key }) => folderEvents.push(key))

    const folderId = useConversationStore.getState().createFolder('Research')
    expect(useConversationStore.getState().folders[folderId]?.name).toBe('Research')

    const folderChangeEvents: Array<string | null> = []
    const unsub2 = eventBus.on('conversation.folderChanged', ({ folderId: fid }) =>
      folderChangeEvents.push(fid)
    )
    useConversationStore.getState().setConversationFolder(conversationId, folderId)

    expect(useConversationStore.getState().conversations[conversationId].folderId).toBe(folderId)
    expect(folderChangeEvents).toEqual([folderId])
    expect(folderEvents).toContain('folders')
    unsub()
    unsub2()
  })

  it('deleting a folder un-assigns any conversations that were in it', () => {
    const conversationId = useConversationStore
      .getState()
      .createConversation('openrouter', 'test-model')
    const folderId = useConversationStore.getState().createFolder('Research')
    useConversationStore.getState().setConversationFolder(conversationId, folderId)

    useConversationStore.getState().deleteFolder(folderId)

    expect(useConversationStore.getState().folders[folderId]).toBeUndefined()
    expect(useConversationStore.getState().conversations[conversationId].folderId).toBeNull()
  })

  it('renaming a folder updates its name', () => {
    const folderId = useConversationStore.getState().createFolder('Old name')
    useConversationStore.getState().renameFolder(folderId, 'New name')
    expect(useConversationStore.getState().folders[folderId].name).toBe('New name')
  })

  it('creates a conversation with a project context: projectId and systemPrompt from options', () => {
    const id = useConversationStore.getState().createConversation('openrouter', 'test-model', {
      projectId: 'proj-1',
      systemPrompt: 'Always cite sources.',
    })
    const conversation = useConversationStore.getState().conversations[id]
    expect(conversation.projectId).toBe('proj-1')
    expect(conversation.systemPrompt).toBe('Always cite sources.')
  })

  it('setConversationProject assigns a project and emits conversation.projectChanged', () => {
    const id = useConversationStore.getState().createConversation('openrouter', 'test-model')
    const seen: Array<string | null> = []
    const unsub = eventBus.on('conversation.projectChanged', ({ projectId }) =>
      seen.push(projectId)
    )

    useConversationStore.getState().setConversationProject(id, 'proj-9')

    expect(useConversationStore.getState().conversations[id].projectId).toBe('proj-9')
    expect(seen).toEqual(['proj-9'])
    unsub()
  })

  describe('branchConversation', () => {
    it('creates a new conversation containing messages up to and including the branch point', () => {
      const sourceId = useConversationStore
        .getState()
        .createConversation('openrouter', 'test-model')
      const m1 = {
        id: 'm1',
        role: 'user' as const,
        content: 'first',
        status: 'complete' as const,
        createdAt: Date.now(),
      }
      const m2 = {
        id: 'm2',
        role: 'assistant' as const,
        content: 'second',
        status: 'complete' as const,
        createdAt: Date.now(),
      }
      const m3 = {
        id: 'm3',
        role: 'user' as const,
        content: 'third',
        status: 'complete' as const,
        createdAt: Date.now(),
      }
      useConversationStore.getState().appendMessage(sourceId, m1)
      useConversationStore.getState().appendMessage(sourceId, m2)
      useConversationStore.getState().appendMessage(sourceId, m3)

      const branchId = useConversationStore.getState().branchConversation(sourceId, 'm2')

      expect(branchId).not.toBeNull()
      const branched = useConversationStore.getState().conversations[branchId!]
      expect(branched.messages).toHaveLength(2) // m1, m2 — not m3
      expect(branched.messages.map((m) => m.content)).toEqual(['first', 'second'])
      expect(branched.title).toContain('(branch)')
      // The source conversation is untouched.
      expect(useConversationStore.getState().conversations[sourceId].messages).toHaveLength(3)
    })

    it('gives branched messages new ids, independent of the source', () => {
      const sourceId = useConversationStore
        .getState()
        .createConversation('openrouter', 'test-model')
      useConversationStore.getState().appendMessage(sourceId, {
        id: 'm1',
        role: 'user',
        content: 'hi',
        status: 'complete',
        createdAt: Date.now(),
      })

      const branchId = useConversationStore.getState().branchConversation(sourceId, 'm1')
      const branched = useConversationStore.getState().conversations[branchId!]
      expect(branched.messages[0].id).not.toBe('m1')
    })

    it('preserves provider, model, and systemPrompt on the branch', () => {
      const sourceId = useConversationStore
        .getState()
        .createConversation('anthropic', 'claude-sonnet-4-5', { systemPrompt: 'Be concise.' })
      useConversationStore.getState().appendMessage(sourceId, {
        id: 'm1',
        role: 'user',
        content: 'hi',
        status: 'complete',
        createdAt: Date.now(),
      })

      const branchId = useConversationStore.getState().branchConversation(sourceId, 'm1')
      const branched = useConversationStore.getState().conversations[branchId!]
      expect(branched.providerId).toBe('anthropic')
      expect(branched.model).toBe('claude-sonnet-4-5')
      expect(branched.systemPrompt).toBe('Be concise.')
    })

    it('selects the newly-branched conversation', () => {
      const sourceId = useConversationStore
        .getState()
        .createConversation('openrouter', 'test-model')
      useConversationStore.getState().appendMessage(sourceId, {
        id: 'm1',
        role: 'user',
        content: 'hi',
        status: 'complete',
        createdAt: Date.now(),
      })
      const branchId = useConversationStore.getState().branchConversation(sourceId, 'm1')
      expect(useConversationStore.getState().activeConversationId).toBe(branchId)
    })

    it('returns null for an unknown source conversation or message id', () => {
      expect(useConversationStore.getState().branchConversation('does-not-exist', 'm1')).toBeNull()
      const sourceId = useConversationStore
        .getState()
        .createConversation('openrouter', 'test-model')
      expect(
        useConversationStore.getState().branchConversation(sourceId, 'no-such-message')
      ).toBeNull()
    })
  })

  describe('duplicateConversation', () => {
    it('creates a full independent copy with all messages', () => {
      const sourceId = useConversationStore
        .getState()
        .createConversation('openrouter', 'test-model')
      useConversationStore.getState().appendMessage(sourceId, {
        id: 'm1',
        role: 'user',
        content: 'hi',
        status: 'complete',
        createdAt: Date.now(),
      })
      useConversationStore.getState().appendMessage(sourceId, {
        id: 'm2',
        role: 'assistant',
        content: 'hello',
        status: 'complete',
        createdAt: Date.now(),
      })

      const dupId = useConversationStore.getState().duplicateConversation(sourceId)
      const duplicated = useConversationStore.getState().conversations[dupId!]
      expect(duplicated.messages).toHaveLength(2)
      expect(duplicated.title).toContain('(copy)')
    })

    it('editing the duplicate does not affect the original', () => {
      const sourceId = useConversationStore
        .getState()
        .createConversation('openrouter', 'test-model')
      useConversationStore.getState().appendMessage(sourceId, {
        id: 'm1',
        role: 'user',
        content: 'original',
        status: 'complete',
        createdAt: Date.now(),
      })
      const dupId = useConversationStore.getState().duplicateConversation(sourceId)!

      useConversationStore
        .getState()
        .updateMessage(dupId, useConversationStore.getState().conversations[dupId].messages[0].id, {
          content: 'edited in duplicate',
        })

      expect(useConversationStore.getState().conversations[sourceId].messages[0].content).toBe(
        'original'
      )
    })

    it('returns null for an unknown conversation id', () => {
      expect(useConversationStore.getState().duplicateConversation('nope')).toBeNull()
    })
  })
})
