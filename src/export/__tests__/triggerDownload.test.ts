import { afterEach, describe, expect, it, vi } from 'vitest'
import { triggerBlobDownload, triggerTextDownload } from '@/export/triggerDownload'

describe('triggerBlobDownload', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates an object URL, clicks a download link with the given filename, and revokes the URL', () => {
    const clickSpy = vi.fn()
    let downloadAttr = ''
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreateElement(tag)
      if (tag === 'a') {
        el.click = clickSpy
        Object.defineProperty(el, 'download', {
          get: () => downloadAttr,
          set: (v) => {
            downloadAttr = v
          },
        })
      }
      return el
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    triggerBlobDownload(new Blob(['hello']), 'greeting.txt')

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(downloadAttr).toBe('greeting.txt')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })
})

describe('triggerTextDownload', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('wraps the text content in a Blob with the given mime type', () => {
    let capturedBlob: Blob | undefined
    vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
      capturedBlob = obj as Blob
      return 'blob:mock-url'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreateElement(tag)
      if (tag === 'a') el.click = vi.fn()
      return el
    })

    triggerTextDownload('{"a":1}', 'data.json', 'application/json')

    expect(capturedBlob?.type).toBe('application/json')
  })
})
