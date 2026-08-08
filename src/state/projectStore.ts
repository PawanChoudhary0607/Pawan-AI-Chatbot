import { create } from 'zustand'
import { eventBus } from '@/events/eventBus'
import type { Project } from '@/types/project'

function makeId(): string {
  return crypto.randomUUID()
}

export interface ProjectState {
  projects: Record<string, Project>
  activeProjectId: string | null

  /** Populates state from storage at app startup. Does NOT emit events. */
  hydrate: (projects: Record<string, Project>, activeProjectId: string | null) => void

  createProject: (name: string) => string
  updateProject: (
    id: string,
    patch: Partial<
      Pick<Project, 'name' | 'description' | 'defaultProviderId' | 'defaultModel' | 'instructions'>
    >
  ) => void
  deleteProject: (id: string) => void
  setActiveProject: (id: string | null) => void
  addPromptPreset: (projectId: string, promptId: string) => void
  removePromptPreset: (projectId: string, promptId: string) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: {},
  activeProjectId: null,

  hydrate: (projects, activeProjectId) => {
    set({ projects, activeProjectId })
  },

  createProject: (name) => {
    const id = makeId()
    const now = Date.now()
    const project: Project = {
      id,
      name,
      promptIds: [],
      createdAt: now,
      updatedAt: now,
    }
    set((state) => ({ projects: { ...state.projects, [id]: project } }))
    eventBus.emit('settings.updated', { key: 'projects' })
    return id
  },

  updateProject: (id, patch) => {
    set((state) => {
      const existing = state.projects[id]
      if (!existing) return state
      return {
        projects: {
          ...state.projects,
          [id]: { ...existing, ...patch, updatedAt: Date.now() },
        },
      }
    })
    eventBus.emit('settings.updated', { key: 'projects' })
  },

  deleteProject: (id) => {
    set((state) => {
      const next = { ...state.projects }
      delete next[id]
      return {
        projects: next,
        activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
      }
    })
    eventBus.emit('settings.updated', { key: 'projects' })
  },

  setActiveProject: (id) => {
    set({ activeProjectId: id })
    eventBus.emit('settings.updated', { key: 'activeProjectId' })
  },

  addPromptPreset: (projectId, promptId) => {
    set((state) => {
      const existing = state.projects[projectId]
      if (!existing || existing.promptIds.includes(promptId)) return state
      return {
        projects: {
          ...state.projects,
          [projectId]: {
            ...existing,
            promptIds: [...existing.promptIds, promptId],
            updatedAt: Date.now(),
          },
        },
      }
    })
    eventBus.emit('settings.updated', { key: 'projects' })
  },

  removePromptPreset: (projectId, promptId) => {
    set((state) => {
      const existing = state.projects[projectId]
      if (!existing) return state
      return {
        projects: {
          ...state.projects,
          [projectId]: {
            ...existing,
            promptIds: existing.promptIds.filter((id) => id !== promptId),
            updatedAt: Date.now(),
          },
        },
      }
    })
    eventBus.emit('settings.updated', { key: 'projects' })
  },
}))
