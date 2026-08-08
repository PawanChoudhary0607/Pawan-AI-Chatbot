import { create } from 'zustand'
import { eventBus } from '@/events/eventBus'
import type { SavedPrompt } from '@/types/prompt'

function makeId(): string {
  return crypto.randomUUID()
}

const MAX_VERSION_HISTORY = 20

export interface PromptState {
  prompts: SavedPrompt[]

  /** Populates state from storage at app startup. Does NOT emit events. */
  hydrate: (prompts: SavedPrompt[]) => void

  createPrompt: (title: string, content: string, category?: string, tags?: string[]) => string
  /** Changing title/content pushes the PRIOR values onto the prompt's
   * version history before applying the patch, so earlier wording is
   * never silently lost. Changing only tags/category does not version. */
  updatePrompt: (
    id: string,
    patch: Partial<Pick<SavedPrompt, 'title' | 'content' | 'category' | 'tags'>>
  ) => void
  /** Restores a prompt to a prior version, pushing the current state onto
   * history first (so restoring is itself undo-able). */
  restoreVersion: (id: string, versionIndex: number) => void
  deletePrompt: (id: string) => void
  toggleFavorite: (id: string) => void
  /** Adds imported prompts to the library. 'merge' keeps existing prompts
   * and appends; 'replace' clears the library first. */
  importPrompts: (prompts: SavedPrompt[], mode: 'merge' | 'replace') => void
}

export const usePromptStore = create<PromptState>((set, get) => ({
  prompts: [],

  hydrate: (prompts) => {
    set({ prompts })
  },

  createPrompt: (title, content, category, tags) => {
    const id = makeId()
    const now = Date.now()
    const prompt: SavedPrompt = {
      id,
      title,
      content,
      category: category?.trim() || undefined,
      tags: tags && tags.length > 0 ? tags : undefined,
      favorite: false,
      createdAt: now,
      updatedAt: now,
    }
    set((state) => ({ prompts: [...state.prompts, prompt] }))
    eventBus.emit('settings.updated', { key: 'prompts' })
    return id
  },

  updatePrompt: (id, patch) => {
    const existing = get().prompts.find((p) => p.id === id)
    const changesContent =
      (patch.title !== undefined && patch.title !== existing?.title) ||
      (patch.content !== undefined && patch.content !== existing?.content)

    set((state) => ({
      prompts: state.prompts.map((p) => {
        if (p.id !== id) return p
        const versions =
          changesContent && (p.title || p.content)
            ? [
                { title: p.title, content: p.content, savedAt: p.updatedAt },
                ...(p.versions ?? []),
              ].slice(0, MAX_VERSION_HISTORY)
            : p.versions
        return { ...p, ...patch, versions, updatedAt: Date.now() }
      }),
    }))
    eventBus.emit('settings.updated', { key: 'prompts' })
  },

  restoreVersion: (id, versionIndex) => {
    set((state) => ({
      prompts: state.prompts.map((p) => {
        if (p.id !== id) return p
        const version = p.versions?.[versionIndex]
        if (!version) return p
        const remainingVersions = (p.versions ?? []).filter((_, i) => i !== versionIndex)
        const newHistory = [
          { title: p.title, content: p.content, savedAt: p.updatedAt },
          ...remainingVersions,
        ].slice(0, MAX_VERSION_HISTORY)
        return {
          ...p,
          title: version.title,
          content: version.content,
          versions: newHistory,
          updatedAt: Date.now(),
        }
      }),
    }))
    eventBus.emit('settings.updated', { key: 'prompts' })
  },

  deletePrompt: (id) => {
    set((state) => ({ prompts: state.prompts.filter((p) => p.id !== id) }))
    eventBus.emit('settings.updated', { key: 'prompts' })
  },

  toggleFavorite: (id) => {
    set((state) => ({
      prompts: state.prompts.map((p) => (p.id === id ? { ...p, favorite: !p.favorite } : p)),
    }))
    eventBus.emit('settings.updated', { key: 'prompts' })
  },

  importPrompts: (prompts, mode) => {
    set((state) => ({
      prompts: mode === 'replace' ? prompts : [...state.prompts, ...prompts],
    }))
    eventBus.emit('settings.updated', { key: 'prompts' })
  },
}))
