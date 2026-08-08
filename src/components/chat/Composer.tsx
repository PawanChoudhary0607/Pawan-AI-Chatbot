import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, ClipboardEvent, DragEvent, KeyboardEvent } from 'react'
import { useConversationStore } from '@/state/conversationStore'
import { useAttachmentStore } from '@/state/attachmentStore'
import { useComposerInsertStore } from '@/state/composerInsertStore'
import { chatService } from '@/chat/chatService'
import { readFileForPipeline } from '@/attachments/readFile'
import { checkAttachmentCompatibility } from '@/attachments/compatibility'
import { AttachmentChip } from '@/components/chat/AttachmentChip'
import type { Attachment } from '@/types/provider'

interface ComposerProps {
  conversationId: string
}

export function Composer({ conversationId }: ComposerProps) {
  const [draft, setDraft] = useState('')
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const conversation = useConversationStore((s) => s.conversations[conversationId])
  const lastMessage = conversation?.messages[conversation.messages.length - 1]
  const isStreaming = lastMessage?.role === 'assistant' && lastMessage.status === 'streaming'
  const providerId = conversation?.providerId ?? ''

  const pendingInsertion = useComposerInsertStore((s) => s.pending[conversationId])
  const consumeInsertion = useComposerInsertStore((s) => s.consume)
  useEffect(() => {
    if (!pendingInsertion) return
    setDraft((prev) => (prev ? `${prev}\n${pendingInsertion.text}` : pendingInsertion.text))
    consumeInsertion(conversationId)
  }, [pendingInsertion, conversationId, consumeInsertion])

  const attachments = useAttachmentStore((s) => s.snapshots[conversationId] ?? [])
  const addAttachment = useAttachmentStore((s) => s.add)
  const removeAttachment = useAttachmentStore((s) => s.remove)
  const markProcessed = useAttachmentStore((s) => s.markProcessed)
  const markReady = useAttachmentStore((s) => s.markReady)
  const markSent = useAttachmentStore((s) => s.markSent)
  const markCompleted = useAttachmentStore((s) => s.markCompleted)
  const markFailed = useAttachmentStore((s) => s.markFailed)
  const clearAttachments = useAttachmentStore((s) => s.clear)
  const getPipeline = useAttachmentStore((s) => s.getPipeline)

  // --- File intake (click-to-upload, drag & drop, clipboard paste) ---
  // All three paths funnel through the same processFile() -> the existing
  // Milestone 5 pipeline. No validation/processing logic lives here.

  const processFile = async (file: File) => {
    const candidate = {
      filename: file.name || 'pasted-image.png',
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
    }
    // add() validates synchronously against the existing rules — a file
    // that fails validation is recorded as 'failed' with its error message
    // and never proceeds to be read or sent.
    const item = addAttachment(conversationId, candidate)
    if (item.processingStatus === 'failed') return

    try {
      const data = await readFileForPipeline(file, item.kind)
      markProcessed(conversationId, item.id, data)
      const previewUrl = item.kind === 'image' ? URL.createObjectURL(file) : undefined
      markReady(conversationId, item.id, previewUrl)
    } catch {
      markFailed(conversationId, item.id, 'Could not read this file.')
    }
  }

  const handleFilesSelected = (files: FileList | File[]) => {
    Array.from(files).forEach((file) => void processFile(file))
  }

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) handleFilesSelected(e.target.files)
    e.target.value = '' // allow re-selecting the same file later
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingOver(false)
    if (e.dataTransfer.files.length > 0) handleFilesSelected(e.dataTransfer.files)
  }

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedFiles = Array.from(e.clipboardData.items)
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null)
    if (pastedFiles.length > 0) handleFilesSelected(pastedFiles)
  }

  // --- Provider-awareness gating ---

  const readyAttachments = attachments.filter((a) => a.processingStatus === 'ready')
  const pendingAttachments = attachments.filter(
    (a) =>
      a.processingStatus === 'queued' ||
      a.processingStatus === 'validated' ||
      a.processingStatus === 'processed'
  )
  const compatibilityByAttachmentId = new Map(
    readyAttachments.map((a) => [a.id, checkAttachmentCompatibility(a, providerId)])
  )
  const hasIncompatibleAttachment = readyAttachments.some(
    (a) => !compatibilityByAttachmentId.get(a.id)?.compatible
  )
  const hasUnresolvedAttachmentState = pendingAttachments.length > 0 || hasIncompatibleAttachment

  const canSend =
    !isStreaming &&
    !hasUnresolvedAttachmentState &&
    (draft.trim().length > 0 || readyAttachments.length > 0)

  const handleSend = () => {
    if (!canSend) return
    const trimmed = draft.trim()

    const wireAttachments: Attachment[] = []
    for (const attachment of readyAttachments) {
      markSent(conversationId, attachment.id)
      const wire = getPipeline(conversationId).toProviderAttachment(attachment.id)
      if (wire) {
        markCompleted(conversationId, attachment.id)
        wireAttachments.push(wire)
      }
    }

    setDraft('')
    clearAttachments(conversationId)
    void chatService.sendUserMessage(conversationId, trimmed, wireAttachments)
  }

  const handleStop = () => {
    chatService.stopStreaming(conversationId)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      className="border-t border-border px-4 py-3"
      onDragOver={(e) => {
        e.preventDefault()
        setIsDraggingOver(true)
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
    >
      {attachments.length > 0 && (
        <div className="mx-auto mb-2 flex max-w-3xl flex-wrap gap-2">
          {attachments.map((attachment) => (
            <AttachmentChip
              key={attachment.id}
              attachment={attachment}
              compatibility={
                attachment.processingStatus === 'ready'
                  ? compatibilityByAttachmentId.get(attachment.id)
                  : undefined
              }
              onRemove={() => removeAttachment(conversationId, attachment.id)}
            />
          ))}
        </div>
      )}

      <div
        className={`mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border px-3 py-2 transition focus-within:ring-1 focus-within:ring-accent ${
          isDraggingOver ? 'border-accent bg-accent/5' : 'border-border bg-surface-raised'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach files"
          className="shrink-0 rounded-lg p-1.5 text-ink-muted transition hover:bg-surface hover:text-ink"
        >
          📎
        </button>

        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          rows={1}
          placeholder={isDraggingOver ? 'Drop files to attach…' : 'Message Pawan AI Chatbot…'}
          disabled={isStreaming}
          className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
        />

        {isStreaming ? (
          <button
            type="button"
            onClick={handleStop}
            className="shrink-0 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-surface-sunken"
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="shrink-0 rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        )}
      </div>
    </div>
  )
}
