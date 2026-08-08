import { create } from 'zustand'

interface PendingInsertion {
  text: string
  nonce: number
}

interface ComposerInsertState {
  pending: Record<string, PendingInsertion | undefined>
  /** Signals that `text` should be appended to `conversationId`'s composer
   * draft. Composer consumes this via an effect and calls consume()
   * immediately after applying it. */
  insert: (conversationId: string, text: string) => void
  consume: (conversationId: string) => void
}

export const useComposerInsertStore = create<ComposerInsertState>((set) => ({
  pending: {},

  insert: (conversationId, text) => {
    set((state) => ({
      pending: { ...state.pending, [conversationId]: { text, nonce: Date.now() } },
    }))
  },

  consume: (conversationId) => {
    set((state) => {
      const next = { ...state.pending }
      delete next[conversationId]
      return { pending: next }
    })
  },
}))
