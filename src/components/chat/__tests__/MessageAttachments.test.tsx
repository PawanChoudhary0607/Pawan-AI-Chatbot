import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MessageAttachments } from '@/components/chat/MessageAttachments'
import type { Attachment } from '@/types/provider'

function makeAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 'a1',
    kind: 'document',
    name: 'notes.md',
    mimeType: 'text/markdown',
    data: 'IyBIZWxsbw==',
    sizeBytes: 2048,
    ...overrides,
  }
}

describe('MessageAttachments', () => {
  it('renders nothing for an empty list', () => {
    const { container } = render(<MessageAttachments attachments={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders an image attachment as a clickable thumbnail', () => {
    render(
      <MessageAttachments
        attachments={[makeAttachment({ name: 'photo.png', mimeType: 'image/png', kind: 'image' })]}
      />
    )
    const img = screen.getByAltText('photo.png') as HTMLImageElement
    expect(img.src).toContain('data:image/png;base64,')
    const anchor = img.closest('a')
    expect(anchor?.getAttribute('href')).toContain('data:image/png;base64,')
  })

  it('renders a non-image attachment as a file card with filename, kind, and size', () => {
    render(<MessageAttachments attachments={[makeAttachment()]} />)
    expect(screen.getByText('notes.md')).toBeInTheDocument()
    expect(screen.getByText(/markdown/i)).toBeInTheDocument()
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument()
  })

  it('renders distinct file cards for pdf, csv, json, and code kinds', () => {
    render(
      <MessageAttachments
        attachments={[
          makeAttachment({ id: 'p', name: 'doc.pdf', mimeType: 'application/pdf' }),
          makeAttachment({ id: 'c', name: 'data.csv', mimeType: 'text/csv' }),
          makeAttachment({ id: 'j', name: 'config.json', mimeType: 'application/json' }),
          makeAttachment({ id: 'k', name: 'main.py', mimeType: 'text/plain' }),
        ]}
      />
    )
    expect(screen.getByText('doc.pdf')).toBeInTheDocument()
    expect(screen.getByText('data.csv')).toBeInTheDocument()
    expect(screen.getByText('config.json')).toBeInTheDocument()
    expect(screen.getByText('main.py')).toBeInTheDocument()
    expect(screen.getByText(/code/i)).toBeInTheDocument()
  })

  it('provides a working download action for non-image attachments', async () => {
    const user = userEvent.setup()
    const clickSpy = vi.fn()
    const realCreateElement = document.createElement.bind(document)
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string) => {
        const el = realCreateElement(tag)
        if (tag === 'a') el.click = clickSpy
        return el
      })

    render(<MessageAttachments attachments={[makeAttachment()]} />)
    await user.click(screen.getByLabelText('Download notes.md'))

    expect(clickSpy).toHaveBeenCalledTimes(1)
    createElementSpy.mockRestore()
  })
})
