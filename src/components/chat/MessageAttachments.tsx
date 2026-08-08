import { classifyAttachment } from '@/attachments/classify'
import { formatBytes } from '@/attachments/format'
import type { AttachmentKind } from '@/attachments/types'
import type { Attachment } from '@/types/provider'

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

function downloadAttachment(attachment: Attachment): void {
  const link = document.createElement('a')
  link.href = `data:${attachment.mimeType};base64,${attachment.data}`
  link.download = attachment.name
  link.click()
}

interface MessageAttachmentsProps {
  attachments: Attachment[]
}

export function MessageAttachments({ attachments }: MessageAttachmentsProps) {
  if (attachments.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((attachment) => {
        const kind = classifyAttachment(attachment.name, attachment.mimeType)
        const dataUrl = `data:${attachment.mimeType};base64,${attachment.data}`

        if (kind === 'image') {
          return (
            <a
              key={attachment.id}
              href={dataUrl}
              target="_blank"
              rel="noreferrer"
              title={`${attachment.name} — ${formatBytes(attachment.sizeBytes)}`}
            >
              <img
                src={dataUrl}
                alt={attachment.name}
                className="h-32 w-32 rounded-lg border border-border object-cover"
              />
            </a>
          )
        }

        return (
          <div
            key={attachment.id}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs"
          >
            <span aria-hidden="true" className="text-base">
              {KIND_ICON[kind]}
            </span>
            <div className="flex flex-col">
              <span className="max-w-[180px] truncate text-ink">{attachment.name}</span>
              <span className="text-ink-faint">
                {formatBytes(attachment.sizeBytes)} · {kind}
              </span>
            </div>
            <button
              type="button"
              onClick={() => downloadAttachment(attachment)}
              aria-label={`Download ${attachment.name}`}
              className="ml-2 text-ink-faint hover:text-ink"
            >
              ⬇
            </button>
          </div>
        )
      })}
    </div>
  )
}
