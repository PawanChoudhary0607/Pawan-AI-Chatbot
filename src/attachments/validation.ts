import { classifyAttachment } from '@/attachments/classify'
import type { AttachmentCandidate, ManagedAttachment } from '@/attachments/types'

export interface AttachmentValidationRules {
  maxSizeBytes: number
  maxCount: number
  /** Exact MIME types or wildcard prefixes like 'image/*'. */
  supportedMimeTypes: string[]
}

export const DEFAULT_VALIDATION_RULES: AttachmentValidationRules = {
  maxSizeBytes: 20 * 1024 * 1024, // 20MB — generic default, independent of any provider's real limit
  maxCount: 10,
  supportedMimeTypes: [
    'image/*',
    'application/pdf',
    'text/markdown',
    'text/plain',
    'text/csv',
    'application/csv',
    'application/json',
    'text/*',
  ],
}

export interface AttachmentValidationResult {
  valid: boolean
  errors: string[]
}

function isMimeSupported(mimeType: string, supported: string[]): boolean {
  const normalized = mimeType.toLowerCase().split(';')[0].trim()
  return supported.some((pattern) => {
    if (pattern.endsWith('/*')) {
      return normalized.startsWith(pattern.slice(0, -1))
    }
    return normalized === pattern.toLowerCase()
  })
}

function isDuplicate(candidate: AttachmentCandidate, existing: ManagedAttachment[]): boolean {
  return existing.some(
    (item) =>
      item.processingStatus !== 'failed' &&
      item.filename === candidate.filename &&
      item.size === candidate.size &&
      item.mimeType === candidate.mimeType
  )
}

/**
 * Validates a candidate attachment against a rule set and the attachments
 * already queued for this conversation. Pure function — no side effects,
 * no provider awareness. The pipeline calls this before an attachment is
 * allowed past the 'queued' stage; nothing downstream (including any
 * provider) ever sees data that failed here.
 */
export function validateAttachment(
  candidate: AttachmentCandidate,
  existing: ManagedAttachment[],
  rules: AttachmentValidationRules = DEFAULT_VALIDATION_RULES
): AttachmentValidationResult {
  const errors: string[] = []

  if (existing.length >= rules.maxCount) {
    errors.push(`Maximum of ${rules.maxCount} attachments reached.`)
  }

  if (candidate.size > rules.maxSizeBytes) {
    const maxMB = (rules.maxSizeBytes / (1024 * 1024)).toFixed(1)
    errors.push(`File exceeds the maximum size of ${maxMB}MB.`)
  }

  if (candidate.size <= 0) {
    errors.push('File appears to be empty.')
  }

  if (!isMimeSupported(candidate.mimeType, rules.supportedMimeTypes)) {
    const kind = classifyAttachment(candidate.filename, candidate.mimeType)
    errors.push(
      kind === 'custom'
        ? `Unsupported file type: ${candidate.mimeType || 'unknown'}.`
        : `${candidate.mimeType} is not in the supported types for this rule set.`
    )
  }

  if (isDuplicate(candidate, existing)) {
    errors.push(`"${candidate.filename}" is already attached.`)
  }

  return { valid: errors.length === 0, errors }
}
