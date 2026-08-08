import { classifyAttachment } from '@/attachments/classify'
import { validateAttachment, DEFAULT_VALIDATION_RULES } from '@/attachments/validation'
import type { AttachmentValidationRules } from '@/attachments/validation'
import type { AttachmentCandidate, AttachmentStage, ManagedAttachment } from '@/attachments/types'
import type { Attachment } from '@/types/provider'

function makeId(): string {
  return crypto.randomUUID()
}

/** Legal forward transitions. 'failed' is reachable from any non-terminal
 * stage; 'completed' and 'failed' are terminal (no way out). Enforcing this
 * table is what "no provider-specific logic inside the pipeline" actually
 * means in practice — the pipeline only ever knows about stages, never
 * about what's going to consume the attachment. */
const ALLOWED_TRANSITIONS: Record<AttachmentStage, AttachmentStage[]> = {
  queued: ['validated', 'failed'],
  validated: ['processed', 'failed'],
  processed: ['ready', 'failed'],
  ready: ['sent', 'failed'],
  sent: ['completed', 'failed'],
  completed: [],
  failed: [],
}

export class AttachmentTransitionError extends Error {
  constructor(
    public readonly attachmentId: string,
    public readonly from: AttachmentStage,
    public readonly to: AttachmentStage
  ) {
    super(`Illegal attachment transition for ${attachmentId}: ${from} -> ${to}`)
    this.name = 'AttachmentTransitionError'
  }
}

/**
 * Manages attachments through Queued -> Validated -> Processed -> Ready ->
 * Sent -> Completed, with Failed reachable at any point. One instance is
 * meant to be scoped per conversation/composer session — it holds no
 * provider references and makes no network calls itself; reading file
 * content is the caller's job (via `markProcessed`), keeping this pipeline
 * a pure state machine that's trivially testable and reusable everywhere.
 */
export class AttachmentPipeline {
  private items = new Map<string, ManagedAttachment>()

  list(): ManagedAttachment[] {
    return Array.from(this.items.values())
  }

  get(id: string): ManagedAttachment | undefined {
    return this.items.get(id)
  }

  remove(id: string): void {
    const item = this.items.get(id)
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
    this.items.delete(id)
  }

  clear(): void {
    for (const item of this.items.values()) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
    }
    this.items.clear()
  }

  /** Enqueues a candidate and immediately validates it (queued ->
   * validated, or queued -> failed). Validation happening synchronously,
   * before any async processing starts, is what guarantees a provider can
   * never receive data that failed validation. */
  add(
    candidate: AttachmentCandidate,
    rules: AttachmentValidationRules = DEFAULT_VALIDATION_RULES
  ): ManagedAttachment {
    const now = Date.now()
    const attachment: ManagedAttachment = {
      id: makeId(),
      filename: candidate.filename,
      mimeType: candidate.mimeType,
      kind: classifyAttachment(candidate.filename, candidate.mimeType),
      size: candidate.size,
      metadata: {},
      processingStatus: 'queued',
      createdAt: now,
      updatedAt: now,
    }
    this.items.set(attachment.id, attachment)
    const result = validateAttachment(
      candidate,
      this.list().filter((a) => a.id !== attachment.id),
      rules
    )

    if (result.valid) {
      this.transition(attachment.id, 'validated')
    } else {
      this.transition(attachment.id, 'failed', { error: result.errors.join(' ') })
    }
    return this.items.get(attachment.id)!
  }

  /** validated -> processed. Caller supplies the actual file content
   * (already read/encoded) — the pipeline never reads files itself, so it
   * stays runnable in any environment (tests included) without a real
   * FileReader/filesystem. */
  markProcessed(
    id: string,
    data: string,
    metadata: Record<string, unknown> = {}
  ): ManagedAttachment {
    return this.transition(id, 'processed', {
      data,
      metadata: { ...this.require(id).metadata, ...metadata },
    })
  }

  /** processed -> ready. Separated from markProcessed so a caller can do
   * additional async work (e.g. generating a preview) between the two
   * without the item looking "processed but not usable yet" ambiguously —
   * 'ready' is the unambiguous "safe to send" signal. */
  markReady(id: string, previewUrl?: string): ManagedAttachment {
    return this.transition(id, 'ready', previewUrl ? { previewUrl } : {})
  }

  /** ready -> sent. Called once a provider request has actually been
   * dispatched with this attachment included. */
  markSent(id: string): ManagedAttachment {
    return this.transition(id, 'sent')
  }

  /** sent -> completed. Called once the provider's response referencing
   * this attachment has fully arrived (stream completed / request
   * resolved). */
  markCompleted(id: string): ManagedAttachment {
    return this.transition(id, 'completed')
  }

  /** Any non-terminal stage -> failed. Safe to call at any point in the
   * lifecycle — this is the one transition allowed from everywhere. */
  markFailed(id: string, error: string): ManagedAttachment {
    return this.transition(id, 'failed', { error })
  }

  /** Converts a 'ready' or later-stage attachment into the existing
   * wire-format Attachment used inside ChatRequest/ChatMessage. Returns
   * null if the attachment isn't far enough along the pipeline to be safe
   * to send — 'processed' alone is deliberately NOT enough (see markReady's
   * doc comment); this is the one place the two type systems meet. */
  toProviderAttachment(id: string): Attachment | null {
    const item = this.require(id)
    const sendableStages: AttachmentStage[] = ['ready', 'sent', 'completed']
    if (!sendableStages.includes(item.processingStatus) || !item.data) return null

    return {
      id: item.id,
      kind: item.kind === 'image' ? 'image' : 'document',
      name: item.filename,
      mimeType: item.mimeType,
      data: item.data,
      sizeBytes: item.size,
    }
  }

  private require(id: string): ManagedAttachment {
    const item = this.items.get(id)
    if (!item) throw new Error(`Unknown attachment id: ${id}`)
    return item
  }

  private transition(
    id: string,
    to: AttachmentStage,
    patch: Partial<ManagedAttachment> = {}
  ): ManagedAttachment {
    const item = this.require(id)
    const allowed = ALLOWED_TRANSITIONS[item.processingStatus]
    if (!allowed.includes(to)) {
      throw new AttachmentTransitionError(id, item.processingStatus, to)
    }
    const updated: ManagedAttachment = {
      ...item,
      ...patch,
      processingStatus: to,
      updatedAt: Date.now(),
    }
    this.items.set(id, updated)
    return updated
  }
}
