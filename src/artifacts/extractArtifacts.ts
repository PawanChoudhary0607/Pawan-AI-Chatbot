import type { Artifact } from '@/types/artifact'
import type { Conversation } from '@/types/conversation'

const CODE_FENCE_PATTERN = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g
/** A GFM pipe table: a header row, a separator row of dashes/colons/pipes,
 * then one or more data rows. */
const TABLE_PATTERN = /^\|.+\|\r?\n\|[\s:|-]+\|\r?\n(\|.+\|\r?\n?)+/gm

/** Minimum size before a plain markdown message (no code fence) is treated
 * as its own "document" artifact, rather than just being normal chat
 * prose. Keeps short replies from cluttering the Artifacts panel. */
const MARKDOWN_DOCUMENT_MIN_LENGTH = 400

function looksLikeJson(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return false
  try {
    JSON.parse(trimmed)
    return true
  } catch {
    return false
  }
}

function titleFor(kind: Artifact['kind'], language: string | undefined, index: number): string {
  if (kind === 'code') return language ? `${language} snippet ${index}` : `Code snippet ${index}`
  if (kind === 'json') return `JSON ${index}`
  if (kind === 'table') return `Table ${index}`
  return `Document ${index}`
}

/**
 * Extracts artifacts from every assistant message in a conversation. Pure
 * and stateless — call it whenever you need the current list; there is
 * nothing to keep in sync because nothing is stored separately.
 */
export function extractArtifactsFromConversation(conversation: Conversation): Artifact[] {
  const artifacts: Artifact[] = []
  let codeCounter = 0
  let jsonCounter = 0
  let tableCounter = 0
  let docCounter = 0

  for (const message of conversation.messages) {
    if (message.role !== 'assistant') continue

    const codeBlocks = Array.from(message.content.matchAll(CODE_FENCE_PATTERN))
    for (const match of codeBlocks) {
      const [, language, body] = match
      const trimmedBody = body.trim()
      if (!trimmedBody) continue

      if (language.toLowerCase() === 'json' || looksLikeJson(trimmedBody)) {
        jsonCounter += 1
        artifacts.push({
          id: `${message.id}-json-${jsonCounter}`,
          conversationId: conversation.id,
          messageId: message.id,
          kind: 'json',
          title: titleFor('json', undefined, jsonCounter),
          content: trimmedBody,
          createdAt: message.createdAt,
        })
      } else {
        codeCounter += 1
        artifacts.push({
          id: `${message.id}-code-${codeCounter}`,
          conversationId: conversation.id,
          messageId: message.id,
          kind: 'code',
          title: titleFor('code', language || undefined, codeCounter),
          content: trimmedBody,
          language: language || undefined,
          createdAt: message.createdAt,
        })
      }
    }

    const tableMatches = Array.from(message.content.matchAll(TABLE_PATTERN))
    for (const match of tableMatches) {
      tableCounter += 1
      artifacts.push({
        id: `${message.id}-table-${tableCounter}`,
        conversationId: conversation.id,
        messageId: message.id,
        kind: 'table',
        title: titleFor('table', undefined, tableCounter),
        content: match[0].trim(),
        createdAt: message.createdAt,
      })
    }

    // Whole-message markdown document: only when there's no code fence
    // (those are already captured individually above) and the message is
    // long enough to be worth surfacing as a standalone artifact.
    if (codeBlocks.length === 0 && message.content.trim().length >= MARKDOWN_DOCUMENT_MIN_LENGTH) {
      docCounter += 1
      artifacts.push({
        id: `${message.id}-doc-${docCounter}`,
        conversationId: conversation.id,
        messageId: message.id,
        kind: 'markdown',
        title: titleFor('markdown', undefined, docCounter),
        content: message.content.trim(),
        createdAt: message.createdAt,
      })
    }

    for (const attachment of message.attachments ?? []) {
      artifacts.push({
        id: `${message.id}-attachment-${attachment.id}`,
        conversationId: conversation.id,
        messageId: message.id,
        kind: 'attachment',
        title: attachment.name,
        content: attachment.data,
        createdAt: message.createdAt,
      })
    }
  }

  return artifacts
}
