import { memo, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import bash from 'highlight.js/lib/languages/bash'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import css from 'highlight.js/lib/languages/css'
import diff from 'highlight.js/lib/languages/diff'
import go from 'highlight.js/lib/languages/go'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import php from 'highlight.js/lib/languages/php'
import python from 'highlight.js/lib/languages/python'
import ruby from 'highlight.js/lib/languages/ruby'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ChatMessage } from '@/types/provider'
import { CodeBlock } from '@/components/chat/CodeBlock'
import { MessageAttachments } from '@/components/chat/MessageAttachments'
import { chatService } from '@/chat/chatService'
import { useConversationStore } from '@/state/conversationStore'
import { createCuratedHighlighter } from '@/lib/rehypeHighlightCurated'

// Explicitly curated rather than lowlight/rehype-highlight's built-in
// "common" set (~37 languages, including several — Arduino, VB.NET, Swift,
// WASM, etc. — essentially never seen in this app's context). Built via our
// own tiny plugin (src/lib/rehypeHighlightCurated.ts) because rehype-highlight
// itself unconditionally imports the full "common" set at module scope for
// its own default-value fallback, even when a custom `languages` option is
// passed — that import isn't tree-shakeable, so using the package at all
// would have defeated the purpose. See the Milestone 8 bundle report.
const HIGHLIGHT_LANGUAGES = {
  bash,
  c,
  cpp,
  css,
  diff,
  go,
  java,
  javascript,
  json,
  markdown,
  php,
  python,
  ruby,
  rust,
  sql,
  typescript,
  xml,
  yaml,
}

const curatedHighlight = createCuratedHighlighter(HIGHLIGHT_LANGUAGES)

/** Above this many messages, switch to virtualized rendering. Below it,
 * plain rendering is simpler and carries no risk of virtualization edge
 * cases — most conversations never get long enough to need this. */
const VIRTUALIZE_THRESHOLD = 40

interface MessageListProps {
  conversationId: string
  messages: ChatMessage[]
}

export function MessageList({ conversationId, messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <p className="mx-auto mt-16 max-w-sm text-center text-sm text-ink-faint">
          Send a message to begin. Streaming, attachments, and tool calls light up here based on
          what the selected provider supports.
        </p>
      </div>
    )
  }

  return messages.length > VIRTUALIZE_THRESHOLD ? (
    <VirtualizedMessageList conversationId={conversationId} messages={messages} />
  ) : (
    <PlainMessageList conversationId={conversationId} messages={messages} />
  )
}

/** Simple, low-risk rendering path for the common case. Auto-sticks to the
 * bottom as new content arrives, unless the user has scrolled up to read
 * earlier history. */
function PlainMessageList({ conversationId, messages }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const shouldStickToBottom = useRef(true)

  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    shouldStickToBottom.current = distanceFromBottom < 80
  }

  const lastMessage = messages[messages.length - 1]
  useEffect(() => {
    if (!shouldStickToBottom.current) return
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
    // Re-run on every content change of the last message too, so streaming
    // text keeps the view pinned to the bottom while it's being written.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, lastMessage?.content])

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-6"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {messages.map((message) => (
          <MessageBubble key={message.id} conversationId={conversationId} message={message} />
        ))}
      </div>
    </div>
  )
}

/** Windowed rendering for long conversations — only mounts DOM for messages
 * near the viewport. Dynamic per-message height via measureElement, since
 * markdown/attachment content varies a lot in size. */
function VirtualizedMessageList({ conversationId, messages }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const shouldStickToBottom = useRef(true)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 120,
    overscan: 8,
  })

  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    shouldStickToBottom.current = distanceFromBottom < 80
  }

  useEffect(() => {
    if (!shouldStickToBottom.current) return
    virtualizer.scrollToIndex(messages.length - 1, { align: 'end' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length])

  const items = virtualizer.getVirtualItems()

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-6"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      <div className="relative mx-auto max-w-3xl" style={{ height: virtualizer.getTotalSize() }}>
        {items.map((virtualItem) => {
          const message = messages[virtualItem.index]
          return (
            <div
              key={message.id}
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
              className="absolute left-0 top-0 w-full pb-6"
              style={{ transform: `translateY(${virtualItem.start}px)` }}
            >
              <MessageBubble conversationId={conversationId} message={message} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface MessageBubbleProps {
  conversationId: string
  message: ChatMessage
}

/** Memoized on the message object reference: conversationStore.updateMessage
 * replaces only the one changed message in the array, so every other
 * message keeps the exact same object reference and this component skips
 * re-rendering for them — the main win during streaming, when the store
 * updates on every token. */
const MessageBubble = memo(function MessageBubble({ conversationId, message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isStreaming = message.status === 'streaming'
  const isError = message.status === 'error'
  const isThinking = isStreaming && message.content.length === 0
  const branchConversation = useConversationStore((s) => s.branchConversation)
  const selectConversation = useConversationStore((s) => s.selectConversation)

  const handleRetry = () => {
    void chatService.retryMessage(conversationId, message.id)
  }

  const handleContinueFromHere = () => {
    const newId = branchConversation(conversationId, message.id)
    if (newId) selectConversation(newId)
  }

  return (
    <div className={`group flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
      <span className="text-xs font-medium text-ink-faint">{isUser ? 'You' : 'Assistant'}</span>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-accent text-white'
            : isError
              ? 'border border-red-500/40 bg-red-500/10 text-ink'
              : 'border border-border bg-surface-raised text-ink'
        }`}
      >
        {isThinking && (
          <span className="flex items-center gap-1 py-0.5" aria-label="Assistant is responding">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint" />
          </span>
        )}
        {message.content && (
          <div className="prose prose-sm max-w-none dark:prose-invert prose-pre:bg-transparent prose-pre:p-0">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[curatedHighlight]}
              components={{ pre: CodeBlock }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        {message.attachments && message.attachments.length > 0 && (
          <MessageAttachments attachments={message.attachments} />
        )}
        {isStreaming && !isThinking && (
          <span
            className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-ink-muted align-text-bottom"
            aria-hidden="true"
          />
        )}
        {isError && (
          <button
            type="button"
            onClick={handleRetry}
            className="mt-2 rounded-lg border border-red-500/40 px-2 py-1 text-xs text-red-700 transition hover:bg-red-500/10 dark:text-red-400"
          >
            ↻ Retry
          </button>
        )}
      </div>
      {!isStreaming && (
        <button
          type="button"
          onClick={handleContinueFromHere}
          aria-label={`Continue from this message`}
          className="hidden text-xs text-ink-faint hover:text-ink group-hover:block"
        >
          🔀 Continue from here
        </button>
      )}
    </div>
  )
})
