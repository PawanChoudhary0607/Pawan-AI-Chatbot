import {
  conversationToJSON,
  conversationToMarkdown,
  slugifyTitle,
} from '@/export/exportConversation'
import { downloadZip } from '@/export/zip'
import { triggerTextDownload } from '@/export/triggerDownload'
import type { Conversation } from '@/types/conversation'

export type MultiExportFormat = 'markdown' | 'json' | 'zip'

/** Exports several conversations at once. 'zip' bundles one file per
 * conversation (format chosen per zipInnerFormat, default markdown).
 * 'markdown'/'json' concatenate everything into a single downloaded file —
 * simplest option when the caller just wants one document to skim. */
export async function downloadConversationsExport(
  conversations: Conversation[],
  format: MultiExportFormat,
  zipInnerFormat: 'markdown' | 'json' = 'markdown'
): Promise<void> {
  if (conversations.length === 0) return

  if (format === 'zip') {
    const files = conversations.map((conversation) => ({
      name: `${slugifyTitle(conversation.title)}.${zipInnerFormat === 'markdown' ? 'md' : 'json'}`,
      content:
        zipInnerFormat === 'markdown'
          ? conversationToMarkdown(conversation)
          : conversationToJSON(conversation),
    }))
    await downloadZip(files, 'conversations-export.zip')
    return
  }

  const content =
    format === 'markdown'
      ? conversations.map(conversationToMarkdown).join('\n\n---\n\n')
      : JSON.stringify(conversations, null, 2)
  const mimeType = format === 'markdown' ? 'text/markdown' : 'application/json'
  const extension = format === 'markdown' ? 'md' : 'json'

  triggerTextDownload(content, `conversations-export.${extension}`, mimeType)
}
