import { describe, expect, it } from 'vitest'
import { classifyAttachment } from '@/attachments/classify'

describe('classifyAttachment', () => {
  const cases: Array<[string, string, string]> = [
    ['photo.png', 'image/png', 'image'],
    ['photo.jpg', 'image/jpeg', 'image'],
    ['scan.pdf', 'application/pdf', 'pdf'],
    ['notes.md', 'text/markdown', 'markdown'],
    ['readme.txt', 'text/plain', 'text'],
    ['data.csv', 'text/csv', 'csv'],
    ['config.json', 'application/json', 'json'],
  ]

  it.each(cases)('classifies %s (%s) as %s', (filename, mimeType, expectedKind) => {
    expect(classifyAttachment(filename, mimeType)).toBe(expectedKind)
  })

  it('classifies known code extensions as "code" even when the MIME type is generic text/plain', () => {
    expect(classifyAttachment('main.py', 'text/plain')).toBe('code')
    expect(classifyAttachment('index.ts', 'text/plain')).toBe('code')
    expect(classifyAttachment('script.sh', 'application/octet-stream')).toBe('code')
  })

  it('falls back to "text" for unrecognized text/* MIME types with no code extension', () => {
    expect(classifyAttachment('notes.log', 'text/x-log')).toBe('text')
  })

  it('falls back to "custom" for anything unrecognized', () => {
    expect(classifyAttachment('archive.zip', 'application/zip')).toBe('custom')
    expect(classifyAttachment('unknown', '')).toBe('custom')
  })

  it('normalizes MIME types with parameters (e.g. "; charset=utf-8")', () => {
    expect(classifyAttachment('readme.txt', 'text/plain; charset=utf-8')).toBe('text')
  })

  it('is case-insensitive on MIME type', () => {
    expect(classifyAttachment('photo.PNG', 'IMAGE/PNG')).toBe('image')
  })
})
