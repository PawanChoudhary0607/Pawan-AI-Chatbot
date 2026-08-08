import { useMemo, useRef } from 'react'
import { extractArtifactsFromConversation } from '@/artifacts/extractArtifacts'
import { useModalA11y } from '@/hooks/useModalA11y'
import { useEnterTransition } from '@/hooks/useEnterTransition'
import { triggerBlobDownload } from '@/export/triggerDownload'
import type { Conversation } from '@/types/conversation'
import type { Artifact, ArtifactKind } from '@/types/artifact'

interface ArtifactsPanelProps {
  conversation: Conversation
  onClose: () => void
}

const KIND_LABEL: Record<ArtifactKind, string> = {
  markdown: 'Document',
  code: 'Code',
  json: 'JSON',
  table: 'Table',
  attachment: 'Attachment',
}

function downloadArtifact(artifact: Artifact): void {
  const extension =
    artifact.kind === 'code'
      ? 'txt'
      : artifact.kind === 'json'
        ? 'json'
        : artifact.kind === 'table'
          ? 'md'
          : artifact.kind === 'attachment'
            ? ''
            : 'md'
  const filename = extension ? `${artifact.title}.${extension}` : artifact.title

  if (artifact.kind === 'attachment') {
    // Attachment content is already base64-encoded — a data: URI, not a
    // blob URL, so there's nothing to revoke here.
    const link = document.createElement('a')
    link.href = `data:application/octet-stream;base64,${artifact.content}`
    link.download = filename
    link.click()
    return
  }

  triggerBlobDownload(new Blob([artifact.content], { type: 'text/plain' }), filename)
}

export function ArtifactsPanel({ conversation, onClose }: ArtifactsPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useModalA11y(containerRef, onClose)
  const entered = useEnterTransition()

  const artifacts = useMemo(() => extractArtifactsFromConversation(conversation), [conversation])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Artifacts"
        className={`flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl border border-border bg-surface-raised shadow-xl transition-all duration-150 ${
          entered ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">Artifacts ({artifacts.length})</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close artifacts"
            className="rounded-lg px-2 py-1 text-ink-muted hover:bg-surface"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {artifacts.length === 0 && (
            <p className="py-8 text-center text-sm text-ink-faint">
              No artifacts yet. Code blocks, JSON, tables, documents, and attachments the assistant
              generates will show up here.
            </p>
          )}
          <div className="space-y-3">
            {artifacts.map((artifact) => (
              <div key={artifact.id} className="rounded-xl border border-border p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                      {KIND_LABEL[artifact.kind]}
                      {artifact.language ? ` · ${artifact.language}` : ''}
                    </span>
                    <span className="text-sm text-ink">{artifact.title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadArtifact(artifact)}
                    aria-label={`Download ${artifact.title}`}
                    className="text-ink-faint hover:text-ink"
                  >
                    ⬇
                  </button>
                </div>
                {artifact.kind !== 'attachment' && (
                  <pre className="max-h-32 overflow-auto rounded-lg bg-surface p-2 text-xs text-ink-muted">
                    {artifact.content.slice(0, 800)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
