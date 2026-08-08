import { useMemo, useRef } from 'react'
import { computeConversationStatistics } from '@/conversations/statistics'
import { providerRegistry } from '@/providers/registry'
import { useModalA11y } from '@/hooks/useModalA11y'
import { useEnterTransition } from '@/hooks/useEnterTransition'
import type { Conversation } from '@/types/conversation'

interface ConversationStatsPanelProps {
  conversation: Conversation
  onClose: () => void
}

export function ConversationStatsPanel({ conversation, onClose }: ConversationStatsPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useModalA11y(containerRef, onClose)
  const entered = useEnterTransition()

  const stats = useMemo(() => computeConversationStatistics(conversation), [conversation])
  const providerName = providerRegistry.get(stats.providerId)?.meta.name ?? stats.providerId

  const rows: Array<[string, string]> = [
    ['Total messages', String(stats.totalMessages)],
    ['From you', String(stats.userMessages)],
    ['From assistant', String(stats.assistantMessages)],
    ['Total characters', stats.totalCharacters.toLocaleString()],
    ['Estimated tokens', stats.estimatedTokens.toLocaleString()],
    ['Attachments', String(stats.attachmentCount)],
    ['Provider', providerName],
    ['Model', stats.model || '(none selected)'],
    ['Created', new Date(stats.createdAt).toLocaleString()],
    ['Last updated', new Date(stats.updatedAt).toLocaleString()],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Conversation statistics"
        className={`w-full max-w-sm rounded-2xl border border-border bg-surface-raised p-5 shadow-xl transition-all duration-150 ${
          entered ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Conversation statistics</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close statistics"
            className="text-ink-muted hover:text-ink"
          >
            ✕
          </button>
        </div>
        <dl className="space-y-1.5 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <dt className="text-ink-faint">{label}</dt>
              <dd className="truncate text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
