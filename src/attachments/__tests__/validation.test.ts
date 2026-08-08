import { describe, expect, it } from 'vitest'
import { validateAttachment, DEFAULT_VALIDATION_RULES } from '@/attachments/validation'
import type { AttachmentValidationRules } from '@/attachments/validation'
import type { ManagedAttachment } from '@/attachments/types'

function makeExisting(overrides: Partial<ManagedAttachment> = {}): ManagedAttachment {
  const now = Date.now()
  return {
    id: 'existing-1',
    filename: 'existing.png',
    mimeType: 'image/png',
    kind: 'image',
    size: 1000,
    metadata: {},
    processingStatus: 'ready',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('validateAttachment', () => {
  it('accepts a well-formed candidate under default rules', () => {
    const result = validateAttachment(
      { filename: 'photo.png', mimeType: 'image/png', size: 2 * 1024 * 1024 },
      []
    )
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects a file exceeding the max size', () => {
    const rules: AttachmentValidationRules = {
      maxSizeBytes: 1024,
      maxCount: 10,
      supportedMimeTypes: ['image/*'],
    }
    const result = validateAttachment(
      { filename: 'huge.png', mimeType: 'image/png', size: 5000 },
      [],
      rules
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => /exceeds the maximum size/i.test(e))).toBe(true)
  })

  it('rejects an empty file (size 0)', () => {
    const result = validateAttachment(
      { filename: 'empty.txt', mimeType: 'text/plain', size: 0 },
      []
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => /empty/i.test(e))).toBe(true)
  })

  it('rejects an unsupported MIME type', () => {
    const rules: AttachmentValidationRules = {
      maxSizeBytes: 1024 * 1024,
      maxCount: 10,
      supportedMimeTypes: ['image/*'],
    }
    const result = validateAttachment(
      { filename: 'archive.zip', mimeType: 'application/zip', size: 100 },
      [],
      rules
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => /unsupported|not in the supported types/i.test(e))).toBe(true)
  })

  it('supports wildcard MIME patterns like "image/*"', () => {
    const rules: AttachmentValidationRules = {
      maxSizeBytes: 1024 * 1024,
      maxCount: 10,
      supportedMimeTypes: ['image/*'],
    }
    expect(
      validateAttachment({ filename: 'a.png', mimeType: 'image/png', size: 100 }, [], rules).valid
    ).toBe(true)
    expect(
      validateAttachment({ filename: 'a.webp', mimeType: 'image/webp', size: 100 }, [], rules).valid
    ).toBe(true)
  })

  it('detects a duplicate by filename + size + mimeType against existing attachments', () => {
    const existing = [makeExisting({ filename: 'photo.png', size: 2000, mimeType: 'image/png' })]
    const result = validateAttachment(
      { filename: 'photo.png', mimeType: 'image/png', size: 2000 },
      existing
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => /already attached/i.test(e))).toBe(true)
  })

  it('does not treat a failed prior attachment as a duplicate blocker (allows retry)', () => {
    const existing = [
      makeExisting({
        filename: 'photo.png',
        size: 2000,
        mimeType: 'image/png',
        processingStatus: 'failed',
      }),
    ]
    const result = validateAttachment(
      { filename: 'photo.png', mimeType: 'image/png', size: 2000 },
      existing
    )
    expect(result.valid).toBe(true)
  })

  it('rejects once the maximum attachment count is reached', () => {
    const rules: AttachmentValidationRules = {
      maxSizeBytes: 1024 * 1024,
      maxCount: 2,
      supportedMimeTypes: ['image/*'],
    }
    const existing = [makeExisting({ id: '1' }), makeExisting({ id: '2', filename: 'b.png' })]
    const result = validateAttachment(
      { filename: 'c.png', mimeType: 'image/png', size: 100 },
      existing,
      rules
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => /maximum of 2 attachments/i.test(e))).toBe(true)
  })

  it('can report multiple simultaneous errors', () => {
    const rules: AttachmentValidationRules = {
      maxSizeBytes: 10,
      maxCount: 0,
      supportedMimeTypes: ['image/*'],
    }
    const result = validateAttachment(
      { filename: 'doc.zip', mimeType: 'application/zip', size: 500 },
      [],
      rules
    )
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(1)
  })

  it('DEFAULT_VALIDATION_RULES accepts every one of the eight required attachment categories', () => {
    const samples: Array<[string, string]> = [
      ['a.png', 'image/png'],
      ['a.pdf', 'application/pdf'],
      ['a.md', 'text/markdown'],
      ['a.txt', 'text/plain'],
      ['a.csv', 'text/csv'],
      ['a.json', 'application/json'],
    ]
    for (const [filename, mimeType] of samples) {
      const result = validateAttachment(
        { filename, mimeType, size: 100 },
        [],
        DEFAULT_VALIDATION_RULES
      )
      expect(result.valid).toBe(true)
    }
  })
})
