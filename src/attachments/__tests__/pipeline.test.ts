import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AttachmentPipeline, AttachmentTransitionError } from '@/attachments/pipeline'
import type { AttachmentValidationRules } from '@/attachments/validation'

describe('AttachmentPipeline', () => {
  let pipeline: AttachmentPipeline

  beforeEach(() => {
    pipeline = new AttachmentPipeline()
  })

  it('walks a valid attachment through the full Queued -> ... -> Completed lifecycle', () => {
    const item = pipeline.add({ filename: 'photo.png', mimeType: 'image/png', size: 1000 })
    expect(item.processingStatus).toBe('validated') // add() validates synchronously

    pipeline.markProcessed(item.id, 'base64-data-here')
    expect(pipeline.get(item.id)?.processingStatus).toBe('processed')
    expect(pipeline.get(item.id)?.data).toBe('base64-data-here')

    pipeline.markReady(item.id, 'blob://preview')
    expect(pipeline.get(item.id)?.processingStatus).toBe('ready')
    expect(pipeline.get(item.id)?.previewUrl).toBe('blob://preview')

    pipeline.markSent(item.id)
    expect(pipeline.get(item.id)?.processingStatus).toBe('sent')

    pipeline.markCompleted(item.id)
    expect(pipeline.get(item.id)?.processingStatus).toBe('completed')
  })

  it('transitions an invalid candidate straight to failed, with the validation error recorded', () => {
    const rules: AttachmentValidationRules = {
      maxSizeBytes: 10,
      maxCount: 10,
      supportedMimeTypes: ['image/*'],
    }
    const item = pipeline.add({ filename: 'huge.png', mimeType: 'image/png', size: 5000 }, rules)
    expect(item.processingStatus).toBe('failed')
    expect(item.error).toMatch(/exceeds the maximum size/i)
  })

  it('classifies the attachment kind automatically when added', () => {
    const item = pipeline.add({ filename: 'notes.md', mimeType: 'text/markdown', size: 100 })
    expect(item.kind).toBe('markdown')
  })

  it('rejects illegal transitions (e.g. skipping straight from validated to sent)', () => {
    const item = pipeline.add({ filename: 'a.png', mimeType: 'image/png', size: 100 })
    expect(() => pipeline.markSent(item.id)).toThrow(AttachmentTransitionError)
  })

  it('rejects transitions on an already-completed attachment', () => {
    const item = pipeline.add({ filename: 'a.png', mimeType: 'image/png', size: 100 })
    pipeline.markProcessed(item.id, 'data')
    pipeline.markReady(item.id)
    pipeline.markSent(item.id)
    pipeline.markCompleted(item.id)

    expect(() => pipeline.markSent(item.id)).toThrow(AttachmentTransitionError)
  })

  it('allows marking failed from any non-terminal stage', () => {
    const queuedThenValidated = pipeline.add({
      filename: 'a.png',
      mimeType: 'image/png',
      size: 100,
    })
    expect(() => pipeline.markFailed(queuedThenValidated.id, 'network error')).not.toThrow()
    expect(pipeline.get(queuedThenValidated.id)?.processingStatus).toBe('failed')

    const other = pipeline.add({ filename: 'b.png', mimeType: 'image/png', size: 100 })
    pipeline.markProcessed(other.id, 'data')
    expect(() => pipeline.markFailed(other.id, 'processing error')).not.toThrow()
    expect(pipeline.get(other.id)?.processingStatus).toBe('failed')
  })

  it('throws when operating on an unknown attachment id', () => {
    expect(() => pipeline.markReady('does-not-exist')).toThrow(/unknown attachment id/i)
  })

  it('toProviderAttachment returns null before the ready stage', () => {
    const item = pipeline.add({ filename: 'a.png', mimeType: 'image/png', size: 100 })
    expect(pipeline.toProviderAttachment(item.id)).toBeNull()
    pipeline.markProcessed(item.id, 'base64data')
    expect(pipeline.toProviderAttachment(item.id)).toBeNull() // 'processed', not yet 'ready'
  })

  it('toProviderAttachment returns null for a failed attachment', () => {
    const item = pipeline.add({ filename: 'a.png', mimeType: 'image/png', size: 100 })
    pipeline.markFailed(item.id, 'oops')
    expect(pipeline.toProviderAttachment(item.id)).toBeNull()
  })

  it('toProviderAttachment converts a ready image attachment into the wire format, mapping kind to "image"', () => {
    const item = pipeline.add({ filename: 'photo.png', mimeType: 'image/png', size: 100 })
    pipeline.markProcessed(item.id, 'base64imagedata')
    pipeline.markReady(item.id)

    const wireAttachment = pipeline.toProviderAttachment(item.id)
    expect(wireAttachment).toEqual({
      id: item.id,
      kind: 'image',
      name: 'photo.png',
      mimeType: 'image/png',
      data: 'base64imagedata',
      sizeBytes: 100,
    })
  })

  it('toProviderAttachment maps every non-image kind to "document" (the wire format only distinguishes image vs. document)', () => {
    const item = pipeline.add({ filename: 'notes.md', mimeType: 'text/markdown', size: 50 })
    pipeline.markProcessed(item.id, '# hello')
    pipeline.markReady(item.id)

    expect(pipeline.toProviderAttachment(item.id)?.kind).toBe('document')
  })

  it('list() and remove() manage the working set without affecting other items', () => {
    const a = pipeline.add({ filename: 'a.png', mimeType: 'image/png', size: 100 })
    const b = pipeline.add({ filename: 'b.png', mimeType: 'image/png', size: 100 })
    expect(pipeline.list()).toHaveLength(2)

    pipeline.remove(a.id)
    expect(pipeline.list()).toHaveLength(1)
    expect(pipeline.get(b.id)).toBeDefined()
    expect(pipeline.get(a.id)).toBeUndefined()
  })

  it('duplicate detection considers attachments already in the pipeline, not just the initial batch', () => {
    pipeline.add({ filename: 'a.png', mimeType: 'image/png', size: 100 })
    const second = pipeline.add({ filename: 'a.png', mimeType: 'image/png', size: 100 })
    expect(second.processingStatus).toBe('failed')
    expect(second.error).toMatch(/already attached/i)
  })

  describe('preview blob URL revocation (Milestone 10A)', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('remove() revokes the item preview URL, if it has one', () => {
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
      const item = pipeline.add({ filename: 'a.png', mimeType: 'image/png', size: 100 })
      pipeline.markProcessed(item.id, 'data')
      pipeline.markReady(item.id, 'blob:preview-1')

      pipeline.remove(item.id)

      expect(revokeSpy).toHaveBeenCalledWith('blob:preview-1')
    })

    it('remove() does not call revokeObjectURL for an item with no preview URL', () => {
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
      // A non-image (document) attachment never gets a previewUrl.
      const item = pipeline.add({ filename: 'a.pdf', mimeType: 'application/pdf', size: 100 })
      pipeline.markProcessed(item.id, 'data')
      pipeline.markReady(item.id) // no previewUrl argument

      pipeline.remove(item.id)

      expect(revokeSpy).not.toHaveBeenCalled()
    })

    it('remove() is a safe no-op for an unknown id (does not throw)', () => {
      expect(() => pipeline.remove('does-not-exist')).not.toThrow()
    })

    it('clear() revokes every tracked preview URL, not just the first', () => {
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
      const a = pipeline.add({ filename: 'a.png', mimeType: 'image/png', size: 100 })
      const b = pipeline.add({ filename: 'b.png', mimeType: 'image/png', size: 100 })
      pipeline.markProcessed(a.id, 'data')
      pipeline.markReady(a.id, 'blob:preview-a')
      pipeline.markProcessed(b.id, 'data')
      pipeline.markReady(b.id, 'blob:preview-b')

      pipeline.clear()

      expect(revokeSpy).toHaveBeenCalledWith('blob:preview-a')
      expect(revokeSpy).toHaveBeenCalledWith('blob:preview-b')
      expect(revokeSpy).toHaveBeenCalledTimes(2)
      expect(pipeline.list()).toHaveLength(0)
    })

    it('clear() does not throw and calls revokeObjectURL zero times on an empty pipeline', () => {
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
      expect(() => pipeline.clear()).not.toThrow()
      expect(revokeSpy).not.toHaveBeenCalled()
    })

    it('clear() skips items that never reached a preview-bearing stage (e.g. failed validation)', () => {
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
      pipeline.add({ filename: 'a.png', mimeType: 'image/png', size: 100 })
      pipeline.add({ filename: 'a.png', mimeType: 'image/png', size: 100 }) // duplicate -> failed

      pipeline.clear()

      expect(revokeSpy).not.toHaveBeenCalled()
    })
  })
})
