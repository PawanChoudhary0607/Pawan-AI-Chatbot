import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  conversationToJSON,
  conversationToMarkdown,
  conversationToPlainText,
  downloadConversationExport,
} from '@/export/exportConversation'
import type { Conversation } from '@/types/conversation'

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  const now = Date.now()
  return {
    id: 'conv-1',
    title: 'Trip to Japan',
    providerId: 'openrouter',
    model: 'test-model',
    temperature: 0.7,
    topP: 1,
    pinned: false,
    archived: false,
    lastOpenedAt: now,
    messages: [
      {
        id: 'm1',
        role: 'user',
        content: 'Where should I visit?',
        status: 'complete',
        createdAt: now,
      },
      {
        id: 'm2',
        role: 'assistant',
        content: 'Try Kyoto and Osaka.',
        status: 'complete',
        createdAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('conversationToMarkdown', () => {
  it('includes the title as a heading and each message with a role heading', () => {
    const md = conversationToMarkdown(makeConversation())
    expect(md).toContain('# Trip to Japan')
    expect(md).toContain('## You')
    expect(md).toContain('Where should I visit?')
    expect(md).toContain('## Assistant')
    expect(md).toContain('Try Kyoto and Osaka.')
  })

  it('notes attachments by name when present', () => {
    const conversation = makeConversation({
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'See attached',
          status: 'complete',
          createdAt: Date.now(),
          attachments: [
            {
              id: 'a1',
              kind: 'image',
              name: 'photo.png',
              mimeType: 'image/png',
              data: 'x',
              sizeBytes: 1,
            },
          ],
        },
      ],
    })
    expect(conversationToMarkdown(conversation)).toContain('photo.png')
  })
})

describe('conversationToJSON', () => {
  it('produces valid, re-parseable JSON containing the full conversation', () => {
    const conversation = makeConversation()
    const json = conversationToJSON(conversation)
    const parsed = JSON.parse(json)
    expect(parsed.id).toBe('conv-1')
    expect(parsed.messages).toHaveLength(2)
  })
})

describe('conversationToPlainText', () => {
  it('renders role labels and content without markdown heading syntax', () => {
    const text = conversationToPlainText(makeConversation())
    expect(text).not.toContain('##')
    expect(text).toContain('You:')
    expect(text).toContain('Assistant:')
    expect(text).toContain('Where should I visit?')
  })
})

describe('downloadConversationExport', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a download link with a slugified filename and triggers a click', () => {
    const clickSpy = vi.fn()
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreateElement(tag)
      if (tag === 'a') el.click = clickSpy
      return el
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    downloadConversationExport(makeConversation(), 'markdown')

    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('uses a .json extension and application/json mime type for JSON export', () => {
    let capturedBlob: Blob | undefined
    vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
      capturedBlob = obj as Blob
      return 'blob:mock-url'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    let downloadAttr = ''
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreateElement(tag)
      if (tag === 'a') {
        el.click = vi.fn()
        Object.defineProperty(el, 'download', {
          get: () => downloadAttr,
          set: (v) => {
            downloadAttr = v
          },
        })
      }
      return el
    })

    downloadConversationExport(makeConversation(), 'json')

    expect(downloadAttr).toMatch(/\.json$/)
    expect(capturedBlob?.type).toBe('application/json')
  })
})
