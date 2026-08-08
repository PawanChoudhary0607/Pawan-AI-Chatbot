import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadProjectExport } from '@/export/exportProject'
import type { Conversation } from '@/types/conversation'
import type { Project } from '@/types/project'

function makeProject(overrides: Partial<Project> = {}): Project {
  const now = Date.now()
  return {
    id: 'proj-1',
    name: 'Research',
    promptIds: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeConversation(id: string, title: string): Conversation {
  const now = Date.now()
  return {
    id,
    title,
    providerId: 'openrouter',
    model: 'test-model',
    temperature: 0.7,
    topP: 1,
    pinned: false,
    archived: false,
    lastOpenedAt: now,
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
}

describe('downloadProjectExport', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('bundles project metadata and every conversation into a single ZIP download', async () => {
    const clicks: string[] = []
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreateElement(tag)
      if (tag === 'a') el.click = () => clicks.push((el as HTMLAnchorElement).download)
      return el
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    await downloadProjectExport(makeProject({ name: 'My Project' }), [
      makeConversation('c1', 'First'),
      makeConversation('c2', 'Second'),
    ])

    expect(clicks).toEqual(['my-project-project-export.zip'])
  })

  it('works with zero conversations (project with no chats yet)', async () => {
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreateElement(tag)
      if (tag === 'a') el.click = vi.fn()
      return el
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    await expect(downloadProjectExport(makeProject(), [])).resolves.not.toThrow()
  })
})
