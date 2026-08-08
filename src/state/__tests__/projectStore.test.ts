import { beforeEach, describe, expect, it } from 'vitest'
import { useProjectStore } from '@/state/projectStore'
import { eventBus } from '@/events/eventBus'

describe('projectStore', () => {
  beforeEach(() => {
    useProjectStore.setState({ projects: {}, activeProjectId: null })
  })

  it('creates a project with sensible defaults', () => {
    const id = useProjectStore.getState().createProject('Research')
    const project = useProjectStore.getState().projects[id]
    expect(project).toMatchObject({ name: 'Research', promptIds: [] })
  })

  it('emits settings.updated with key "projects" on create', () => {
    const seen: string[] = []
    const unsub = eventBus.on('settings.updated', ({ key }) => seen.push(key))
    useProjectStore.getState().createProject('Research')
    expect(seen).toContain('projects')
    unsub()
  })

  it('updates project fields: defaults and instructions', () => {
    const id = useProjectStore.getState().createProject('Research')
    useProjectStore.getState().updateProject(id, {
      defaultProviderId: 'openrouter',
      defaultModel: 'test-model',
      instructions: 'Always cite sources.',
    })
    const project = useProjectStore.getState().projects[id]
    expect(project.defaultProviderId).toBe('openrouter')
    expect(project.defaultModel).toBe('test-model')
    expect(project.instructions).toBe('Always cite sources.')
  })

  it('deletes a project and clears activeProjectId if it was active', () => {
    const id = useProjectStore.getState().createProject('Research')
    useProjectStore.getState().setActiveProject(id)

    useProjectStore.getState().deleteProject(id)

    expect(useProjectStore.getState().projects[id]).toBeUndefined()
    expect(useProjectStore.getState().activeProjectId).toBeNull()
  })

  it('sets and clears the active project', () => {
    const id = useProjectStore.getState().createProject('Research')
    useProjectStore.getState().setActiveProject(id)
    expect(useProjectStore.getState().activeProjectId).toBe(id)

    useProjectStore.getState().setActiveProject(null)
    expect(useProjectStore.getState().activeProjectId).toBeNull()
  })

  it('adds and removes prompt presets, without duplicating an already-added preset', () => {
    const id = useProjectStore.getState().createProject('Research')
    useProjectStore.getState().addPromptPreset(id, 'prompt-1')
    useProjectStore.getState().addPromptPreset(id, 'prompt-1') // duplicate, should be a no-op
    useProjectStore.getState().addPromptPreset(id, 'prompt-2')

    expect(useProjectStore.getState().projects[id].promptIds).toEqual(['prompt-1', 'prompt-2'])

    useProjectStore.getState().removePromptPreset(id, 'prompt-1')
    expect(useProjectStore.getState().projects[id].promptIds).toEqual(['prompt-2'])
  })

  it('hydrate restores projects and active project without emitting events', () => {
    const seen: string[] = []
    const unsub = eventBus.on('settings.updated', ({ key }) => seen.push(key))

    const now = Date.now()
    useProjectStore
      .getState()
      .hydrate(
        { p1: { id: 'p1', name: 'Restored', promptIds: [], createdAt: now, updatedAt: now } },
        'p1'
      )

    expect(useProjectStore.getState().projects.p1.name).toBe('Restored')
    expect(useProjectStore.getState().activeProjectId).toBe('p1')
    expect(seen).toEqual([])
    unsub()
  })
})
