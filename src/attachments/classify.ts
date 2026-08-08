import type { AttachmentKind } from '@/attachments/types'

const MIME_KIND_MAP: Record<string, AttachmentKind> = {
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'image/heic': 'image',
  'application/pdf': 'pdf',
  'text/markdown': 'markdown',
  'text/plain': 'text',
  'text/csv': 'csv',
  'application/csv': 'csv',
  'application/json': 'json',
}

/** Extensions treated as source code when the MIME type alone isn't
 * decisive (browsers/OSes often report these as text/plain or leave the
 * type blank). Not exhaustive by design — anything not recognized falls
 * back to 'text' (if text-like) or 'custom', both of which future
 * providers/features can still handle generically. */
const CODE_EXTENSIONS = [
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.c',
  '.h',
  '.cpp',
  '.hpp',
  '.rb',
  '.php',
  '.sh',
  '.css',
  '.html',
  '.sql',
  '.yaml',
  '.yml',
  '.toml',
]

function hasCodeExtension(filename: string): boolean {
  const lower = filename.toLowerCase()
  return CODE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

/** Classifies a file into one of the eight AttachmentKind values. Pure
 * function of (filename, mimeType) — no provider, no I/O, fully generic. */
export function classifyAttachment(filename: string, mimeType: string): AttachmentKind {
  const normalizedMime = mimeType.toLowerCase().split(';')[0].trim()
  const exactMatch = MIME_KIND_MAP[normalizedMime]

  // Unambiguous exact matches (image/png, application/pdf, text/markdown,
  // text/csv, application/json, ...) are authoritative and never
  // overridden by filename. 'text/plain' is deliberately excluded here —
  // browsers/OSes commonly report source files this way, so a recognized
  // code extension should win over that specific, ambiguous default.
  if (exactMatch && exactMatch !== 'text') return exactMatch

  if (normalizedMime.startsWith('image/')) return 'image'

  if (hasCodeExtension(filename)) return 'code'

  if (exactMatch === 'text') return 'text'
  if (normalizedMime.startsWith('text/')) return 'text'

  return 'custom'
}
