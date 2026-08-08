import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadZip } from '@/export/zip'

describe('downloadZip', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('bundles the given files and triggers a single download', async () => {
    const clickSpy = vi.fn()
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreateElement(tag)
      if (tag === 'a') el.click = clickSpy
      return el
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-zip-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    await downloadZip(
      [
        { name: 'a.md', content: '# A' },
        { name: 'b.json', content: '{"b":1}' },
      ],
      'bundle.zip'
    )

    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-zip-url')
  })

  it('sets the download filename to the requested zip name', async () => {
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
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    await downloadZip([{ name: 'a.md', content: 'x' }], 'my-export.zip')

    expect(downloadAttr).toBe('my-export.zip')
  })
})
