import { describe, expect, it } from 'vitest'
import { searchProjects } from '@/search/searchProjects'
import type { Project } from '@/types/project'

function makeProject(overrides: Partial<Project> = {}): Project {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    name: 'Untitled',
    promptIds: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('searchProjects', () => {
  it('returns no matches for an empty query', () => {
    expect(searchProjects([makeProject({ name: 'Research' })], '')).toEqual([])
  })

  it('matches by name', () => {
    const projects = [makeProject({ name: 'Marketing Copy' }), makeProject({ name: 'Research' })]
    const results = searchProjects(projects, 'research')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Research')
  })

  it('matches by description', () => {
    const projects = [makeProject({ name: 'X', description: 'A project about quantum computing' })]
    expect(searchProjects(projects, 'quantum')).toHaveLength(1)
  })

  it('returns empty when nothing matches', () => {
    expect(searchProjects([makeProject({ name: 'X' })], 'zzz')).toEqual([])
  })
})
