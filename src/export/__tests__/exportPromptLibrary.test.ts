import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadPromptLibraryExport } from '@/export/exportPromptLibrary'
import type { SavedPrompt } from '@/types/prompt'

function makePrompt(id: string, title: string): SavedPrompt {
  const now = Date.now()
  return { id, title, content: 'content', favorite: false, createdAt: now, updatedAt: now }
}

function mockDownloadAnchor() {
  const clicks: string[] = []
  const realCreateElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = realCreateElement(tag)
    if (tag === 'a') el.click = () => clicks.push((el as HTMLAnchorElement).download)
    return el
  })
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  return clicks
}

describe('downloadPromptLibraryExport', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exports as a single Markdown file', async () => {
    const clicks = mockDownloadAnchor()
    await downloadPromptLibraryExport([makePrompt('p1', 'A'), makePrompt('p2', 'B')], 'markdown')
    expect(clicks).toEqual(['prompt-library.md'])
  })

  it('exports as a single JSON file', async () => {
    const clicks = mockDownloadAnchor()
    await downloadPromptLibraryExport([makePrompt('p1', 'A')], 'json')
    expect(clicks).toEqual(['prompt-library.json'])
  })

  it('exports as a ZIP with one file per prompt plus a combined JSON index', async () => {
    const clicks = mockDownloadAnchor()
    await downloadPromptLibraryExport([makePrompt('p1', 'A'), makePrompt('p2', 'B')], 'zip')
    expect(clicks).toEqual(['prompt-library-export.zip'])
  })
})
