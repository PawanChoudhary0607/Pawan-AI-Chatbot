import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadConversationsExport } from '@/export/exportMultipleConversations'
import type { Conversation } from '@/types/conversation'

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
    messages: [{ id: `${id}-m1`, role: 'user', content: 'hi', status: 'complete', createdAt: now }],
    createdAt: now,
    updatedAt: now,
  }
}

function mockDownloadAnchor() {
  const clicks: string[] = []
  const realCreateElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = realCreateElement(tag)
    if (tag === 'a') {
      el.click = () => clicks.push(el.getAttribute('download') ?? '')
    }
    return el
  })
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  return clicks
}

describe('downloadConversationsExport', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does nothing for an empty selection', async () => {
    const clicks = mockDownloadAnchor()
    await downloadConversationsExport([], 'markdown')
    expect(clicks).toEqual([])
  })

  it('exports multiple conversations as a single combined Markdown file', async () => {
    const clicks = mockDownloadAnchor()
    await downloadConversationsExport(
      [makeConversation('c1', 'First'), makeConversation('c2', 'Second')],
      'markdown'
    )
    expect(clicks).toEqual(['conversations-export.md'])
  })

  it('exports multiple conversations as a single combined JSON file', async () => {
    const clicks = mockDownloadAnchor()
    await downloadConversationsExport(
      [makeConversation('c1', 'First'), makeConversation('c2', 'Second')],
      'json'
    )
    expect(clicks).toEqual(['conversations-export.json'])
  })

  it('exports multiple conversations as a ZIP with one file per conversation', async () => {
    const clicks = mockDownloadAnchor()
    await downloadConversationsExport(
      [makeConversation('c1', 'First'), makeConversation('c2', 'Second')],
      'zip'
    )
    expect(clicks).toEqual(['conversations-export.zip'])
  })
})
