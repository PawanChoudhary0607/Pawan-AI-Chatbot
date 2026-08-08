import {
  conversationToJSON,
  conversationToMarkdown,
  slugifyTitle,
} from '@/export/exportConversation'
import { downloadZip } from '@/export/zip'
import type { Conversation } from '@/types/conversation'
import type { Project } from '@/types/project'

/** Bundles a project's metadata (name, instructions, defaults) alongside
 * every one of its conversations, both as Markdown and as JSON, into a
 * single ZIP download. */
export async function downloadProjectExport(
  project: Project,
  conversations: Conversation[]
): Promise<void> {
  const files = [
    {
      name: 'project.json',
      content: JSON.stringify(project, null, 2),
    },
    {
      name: 'README.md',
      content: [
        `# ${project.name}`,
        '',
        project.description ?? '',
        '',
        project.instructions ? `## Instructions\n\n${project.instructions}` : '',
        '',
        `## Conversations (${conversations.length})`,
        '',
        ...conversations.map((c) => `- ${c.title}`),
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ]

  conversations.forEach((conversation, index) => {
    const base = `conversations/${String(index + 1).padStart(2, '0')}-${slugifyTitle(conversation.title)}`
    files.push({ name: `${base}.md`, content: conversationToMarkdown(conversation) })
    files.push({ name: `${base}.json`, content: conversationToJSON(conversation) })
  })

  await downloadZip(files, `${slugifyTitle(project.name)}-project-export.zip`)
}
