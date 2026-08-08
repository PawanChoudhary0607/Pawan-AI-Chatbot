/**
 * Attachment infrastructure (Milestone 5).
 *
 * This is deliberately a SEPARATE, richer model from `Attachment` in
 * src/types/provider.ts. That existing type is the lean wire format sent
 * inside a ChatRequest — it hasn't changed and won't. `ManagedAttachment`
 * is the app-side representation of a file moving through validation and
 * processing before it ever becomes a wire-format Attachment. No UI wires
 * this up yet (no attach button exists) — this milestone only builds the
 * reusable system underneath it.
 */

/** The eight required categories, plus an open-ended escape hatch for
 * anything a future provider or feature needs that doesn't fit. */
export type AttachmentKind =
  'image' | 'pdf' | 'markdown' | 'text' | 'csv' | 'json' | 'code' | 'custom'

/** Pipeline stages, in their required order. 'failed' is reachable from any
 * non-terminal stage rather than only appearing at the end of the chain. */
export type AttachmentStage =
  'queued' | 'validated' | 'processed' | 'ready' | 'sent' | 'completed' | 'failed'

export interface AttachmentMetadata {
  [key: string]: unknown
}

export interface ManagedAttachment {
  id: string
  filename: string
  mimeType: string
  kind: AttachmentKind
  size: number
  /** Object URL or data URL for showing a thumbnail/preview — optional,
   * never required by the pipeline itself. */
  previewUrl?: string
  metadata: AttachmentMetadata
  processingStatus: AttachmentStage
  /** Populated once processed: base64 for binary kinds (image/pdf), raw
   * text for text-like kinds (markdown/text/csv/json/code). Absent before
   * the 'processed' stage. */
  data?: string
  error?: string
  createdAt: number
  updatedAt: number
}

/** What the caller supplies to enqueue a new attachment — everything the
 * pipeline needs to know before it has read any file content. */
export interface AttachmentCandidate {
  filename: string
  mimeType: string
  size: number
}
