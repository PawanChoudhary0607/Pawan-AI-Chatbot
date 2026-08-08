import { formatBytes } from '@/attachments/format'
import type { AttachmentCompatibility } from '@/attachments/compatibility'
import type { AttachmentKind, ManagedAttachment } from '@/attachments/types'

const KIND_ICON: Record<AttachmentKind, string> = {
  image: '🖼️',
  pdf: '📄',
  markdown: '📝',
  text: '📃',
  csv: '📊',
  json: '🧾',
  code: '💻',
  custom: '📎',
}

interface AttachmentChipProps {
  attachment: ManagedAttachment
  /** Only meaningful once the attachment is 'ready' — earlier stages have
   * nothing to check compatibility against yet. */
  compatibility?: AttachmentCompatibility
  onRemove: () => void
}

export function AttachmentChip({ attachment, compatibility, onRemove }: AttachmentChipProps) {
  const isFailed = attachment.processingStatus === 'failed'
  const isPending =
    attachment.processingStatus === 'queued' ||
    attachment.processingStatus === 'validated' ||
    attachment.processingStatus === 'processed'
  const isIncompatible = Boolean(compatibility && !compatibility.compatible)
  const isProblem = isFailed || isIncompatible

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 text-xs ${
        isProblem ? 'border-red-500/40 bg-red-500/10' : 'border-border bg-surface-raised'
      }`}
    >
      {attachment.kind === 'image' && attachment.previewUrl ? (
        <img src={attachment.previewUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
      ) : (
        <span aria-hidden="true" className="shrink-0 text-base">
          {KIND_ICON[attachment.kind]}
        </span>
      )}

      <div className="flex min-w-0 flex-col">
        <span className="max-w-[160px] truncate text-ink" title={attachment.filename}>
          {attachment.filename}
        </span>
        {isFailed && (
          <span
            className="max-w-[160px] truncate text-red-700 dark:text-red-400"
            title={attachment.error}
          >
            {attachment.error ?? 'Failed to attach'}
          </span>
        )}
        {!isFailed && isIncompatible && (
          <span
            className="max-w-[160px] truncate text-red-700 dark:text-red-400"
            title={compatibility?.reason}
          >
            {compatibility?.reason}
          </span>
        )}
        {!isProblem && isPending && <span className="text-ink-faint">Processing…</span>}
        {!isProblem && !isPending && (
          <span className="text-ink-faint">{formatBytes(attachment.size)}</span>
        )}
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${attachment.filename}`}
        className="ml-1 shrink-0 text-ink-faint hover:text-ink"
      >
        ✕
      </button>
    </div>
  )
}
