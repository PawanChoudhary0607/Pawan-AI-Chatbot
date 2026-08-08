import { triggerTextDownload } from '@/export/triggerDownload'
import type { Conversation } from '@/types/conversation'

function roleLabel(role: string): string {
  return role === 'user' ? 'You' : role === 'assistant' ? 'Assistant' : role
}

/** Renders a conversation as a readable Markdown document — a level-1
 * title, then a level-2 heading per message with its role and content. */
export function conversationToMarkdown(conversation: Conversation): string {
  const lines: string[] = [`# ${conversation.title}`, '']
  for (const message of conversation.messages) {
    lines.push(`## ${roleLabel(message.role)}`, '', message.content, '')
    if (message.attachments && message.attachments.length > 0) {
      lines.push(`_Attachments: ${message.attachments.map((a) => a.name).join(', ')}_`, '')
    }
  }
  return lines.join('\n')
}

/** Renders the full Conversation object as pretty-printed JSON — a
 * complete, re-importable snapshot (messages, provider/model, timestamps). */
export function conversationToJSON(conversation: Conversation): string {
  return JSON.stringify(conversation, null, 2)
}

/** Plain-text rendering used for "Copy entire conversation" — similar to
 * the Markdown export but without heading markup, since it's meant to be
 * pasted into an arbitrary text field rather than rendered. */
export function conversationToPlainText(conversation: Conversation): string {
  const lines: string[] = [conversation.title, '']
  for (const message of conversation.messages) {
    lines.push(`${roleLabel(message.role)}:`, message.content, '')
  }
  return lines.join('\n').trim()
}

export function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'conversation'
}

/** Triggers a browser download of the conversation in the requested
 * format. */
export function downloadConversationExport(
  conversation: Conversation,
  format: 'markdown' | 'json'
): void {
  const content =
    format === 'markdown' ? conversationToMarkdown(conversation) : conversationToJSON(conversation)
  const mimeType = format === 'markdown' ? 'text/markdown' : 'application/json'
  const extension = format === 'markdown' ? 'md' : 'json'

  triggerTextDownload(content, `${slugifyTitle(conversation.title)}.${extension}`, mimeType)
}
