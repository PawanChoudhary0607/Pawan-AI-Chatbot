import { create } from 'zustand'
import { AttachmentPipeline } from '@/attachments/pipeline'
import type { AttachmentCandidate, ManagedAttachment } from '@/attachments/types'
import type { AttachmentValidationRules } from '@/attachments/validation'

// One AttachmentPipeline per conversation, held outside Zustand (it's a
// plain mutable class, not serializable state). Zustand only ever holds a
// *snapshot* (`snapshots`) taken after each mutation, which is what
// triggers React re-renders — the pipeline itself is the single source of
// truth, this is purely a reactivity bridge around it.
const pipelines = new Map<string, AttachmentPipeline>()

function getOrCreatePipeline(conversationId: string): AttachmentPipeline {
  let pipeline = pipelines.get(conversationId)
  if (!pipeline) {
    pipeline = new AttachmentPipeline()
    pipelines.set(conversationId, pipeline)
  }
  return pipeline
}

interface AttachmentStoreState {
  snapshots: Record<string, ManagedAttachment[]>

  getPipeline: (conversationId: string) => AttachmentPipeline
  add: (
    conversationId: string,
    candidate: AttachmentCandidate,
    rules?: AttachmentValidationRules
  ) => ManagedAttachment
  remove: (conversationId: string, attachmentId: string) => void
  markProcessed: (conversationId: string, attachmentId: string, data: string) => void
  markReady: (conversationId: string, attachmentId: string, previewUrl?: string) => void
  markSent: (conversationId: string, attachmentId: string) => void
  markCompleted: (conversationId: string, attachmentId: string) => void
  markFailed: (conversationId: string, attachmentId: string, error: string) => void
  /** Clears all attachments for a conversation — called once a message
   * carrying them has been dispatched, so the composer resets for the next
   * message. Also called when the conversation itself is deleted (see
   * persistenceService's 'conversation.deleted' handler). */
  clear: (conversationId: string) => void
  /** Revokes every preview blob URL currently tracked across every
   * conversation's pipeline, without otherwise touching state. Intended as
   * a last-resort safety net on app teardown, not part of normal flow —
   * clear()/remove() already revoke as they go. */
  revokeAllPreviewUrls: () => void
}

export const useAttachmentStore = create<AttachmentStoreState>((set) => {
  function sync(conversationId: string) {
    const pipeline = getOrCreatePipeline(conversationId)
    set((state) => ({
      snapshots: { ...state.snapshots, [conversationId]: pipeline.list() },
    }))
  }

  return {
    snapshots: {},
    getPipeline: getOrCreatePipeline,

    add: (conversationId, candidate, rules) => {
      const item = getOrCreatePipeline(conversationId).add(candidate, rules)
      sync(conversationId)
      return item
    },
    remove: (conversationId, attachmentId) => {
      getOrCreatePipeline(conversationId).remove(attachmentId)
      sync(conversationId)
    },
    markProcessed: (conversationId, attachmentId, data) => {
      getOrCreatePipeline(conversationId).markProcessed(attachmentId, data)
      sync(conversationId)
    },
    markReady: (conversationId, attachmentId, previewUrl) => {
      getOrCreatePipeline(conversationId).markReady(attachmentId, previewUrl)
      sync(conversationId)
    },
    markSent: (conversationId, attachmentId) => {
      getOrCreatePipeline(conversationId).markSent(attachmentId)
      sync(conversationId)
    },
    markCompleted: (conversationId, attachmentId) => {
      getOrCreatePipeline(conversationId).markCompleted(attachmentId)
      sync(conversationId)
    },
    markFailed: (conversationId, attachmentId, error) => {
      getOrCreatePipeline(conversationId).markFailed(attachmentId, error)
      sync(conversationId)
    },
    clear: (conversationId) => {
      // Route through the pipeline's own clear() rather than just dropping
      // the map entry — that's what actually revokes each item's preview
      // blob URL. Skipping this was the source of a real leak: every image
      // attachment ever sent (or removed via conversation deletion) left
      // its blob URL alive for the rest of the page's lifetime.
      pipelines.get(conversationId)?.clear()
      pipelines.delete(conversationId)
      set((state) => {
        const next = { ...state.snapshots }
        delete next[conversationId]
        return { snapshots: next }
      })
    },
    revokeAllPreviewUrls: () => {
      for (const pipeline of pipelines.values()) {
        pipeline.clear()
      }
    },
  }
})
