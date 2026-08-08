import { lazy, Suspense, useState } from 'react'
import { useConversationStore } from '@/state/conversationStore'
import { MessageList } from '@/components/chat/MessageList'
import { Composer } from '@/components/chat/Composer'
import { ProviderModelSelector } from '@/components/chat/ProviderModelSelector'
import { conversationToPlainText, downloadConversationExport } from '@/export/exportConversation'
import { useCloseOnEscape } from '@/hooks/useCloseOnEscape'
import { ModalSkeleton } from '@/components/layout/ModalSkeleton'
import type { Conversation } from '@/types/conversation'

const ArtifactsPanel = lazy(() =>
  import('@/components/artifacts/ArtifactsPanel').then((m) => ({ default: m.ArtifactsPanel }))
)
const ConversationStatsPanel = lazy(() =>
  import('@/components/conversations/ConversationStatsPanel').then((m) => ({
    default: m.ConversationStatsPanel,
  }))
)

interface ChatPanelProps {
  onOpenSidebar: () => void
}

export function ChatPanel({ onOpenSidebar }: ChatPanelProps) {
  const conversation = useConversationStore((s) =>
    s.activeConversationId ? s.conversations[s.activeConversationId] : undefined
  )
  const [artifactsOpen, setArtifactsOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-raised md:hidden"
          aria-label="Open conversations"
        >
          ☰
        </button>
        <h1 className="truncate text-sm font-medium text-ink">
          {conversation?.title ?? 'Pawan AI Chatbot'}
        </h1>
        <div className="ml-auto flex items-center gap-2">
          {conversation && (
            <ConversationActionsMenu
              conversation={conversation}
              onOpenArtifacts={() => setArtifactsOpen(true)}
              onOpenStats={() => setStatsOpen(true)}
            />
          )}
          {conversation && (
            <ProviderModelSelector
              conversationId={conversation.id}
              providerId={conversation.providerId}
              model={conversation.model}
            />
          )}
        </div>
      </header>

      {conversation ? (
        <>
          <MessageList conversationId={conversation.id} messages={conversation.messages} />
          <Composer conversationId={conversation.id} />
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-lg font-medium text-ink">Start a new conversation</p>
          <p className="max-w-sm text-sm text-ink-muted">
            Pick a provider and model from the sidebar, or connect a local Ollama server, then start
            chatting. Nothing you type leaves your device unless a cloud provider is used.
          </p>
        </div>
      )}

      <Suspense fallback={<ModalSkeleton />}>
        {conversation && artifactsOpen && (
          <ArtifactsPanel conversation={conversation} onClose={() => setArtifactsOpen(false)} />
        )}
        {conversation && statsOpen && (
          <ConversationStatsPanel conversation={conversation} onClose={() => setStatsOpen(false)} />
        )}
      </Suspense>
    </div>
  )
}

interface ConversationActionsMenuProps {
  conversation: Conversation
  onOpenArtifacts: () => void
  onOpenStats: () => void
}

function ConversationActionsMenu({
  conversation,
  onOpenArtifacts,
  onOpenStats,
}: ConversationActionsMenuProps) {
  const [open, setOpen] = useState(false)
  useCloseOnEscape(open, () => setOpen(false))
  const [copied, setCopied] = useState(false)
  const duplicateConversation = useConversationStore((s) => s.duplicateConversation)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(conversationToPlainText(conversation))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Conversation actions"
        className="rounded-lg px-2 py-1 text-xs text-ink-muted hover:bg-surface-raised hover:text-ink"
      >
        ⋯
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-border bg-surface-raised p-1 text-xs shadow-lg">
            <button
              type="button"
              onClick={() => {
                duplicateConversation(conversation.id)
                setOpen(false)
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-ink-muted hover:bg-surface hover:text-ink"
            >
              Duplicate conversation
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenStats()
                setOpen(false)
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-ink-muted hover:bg-surface hover:text-ink"
            >
              Conversation statistics
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenArtifacts()
                setOpen(false)
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-ink-muted hover:bg-surface hover:text-ink"
            >
              View artifacts
            </button>
            <div className="my-1 border-t border-border" />
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="block w-full rounded-lg px-3 py-2 text-left text-ink-muted hover:bg-surface hover:text-ink"
            >
              {copied ? 'Copied!' : 'Copy entire conversation'}
            </button>
            <button
              type="button"
              onClick={() => {
                downloadConversationExport(conversation, 'markdown')
                setOpen(false)
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-ink-muted hover:bg-surface hover:text-ink"
            >
              Export as Markdown
            </button>
            <button
              type="button"
              onClick={() => {
                downloadConversationExport(conversation, 'json')
                setOpen(false)
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-ink-muted hover:bg-surface hover:text-ink"
            >
              Export as JSON
            </button>
          </div>
        </>
      )}
    </div>
  )
}
