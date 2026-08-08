import { exportPromptsAsJSON, exportPromptsAsMarkdown } from '@/prompts/importExport'
import { downloadZip } from '@/export/zip'
import { slugifyTitle } from '@/export/exportConversation'
import { triggerTextDownload } from '@/export/triggerDownload'
import type { SavedPrompt } from '@/types/prompt'

export type PromptLibraryExportFormat = 'markdown' | 'json' | 'zip'

export async function downloadPromptLibraryExport(
  prompts: SavedPrompt[],
  format: PromptLibraryExportFormat
): Promise<void> {
  if (format === 'zip') {
    const files = prompts.map((prompt, index) => ({
      name: `${String(index + 1).padStart(2, '0')}-${slugifyTitle(prompt.title)}.md`,
      content: exportPromptsAsMarkdown([prompt]),
    }))
    files.push({ name: 'prompts.json', content: exportPromptsAsJSON(prompts) })
    await downloadZip(files, 'prompt-library-export.zip')
    return
  }

  const content =
    format === 'markdown' ? exportPromptsAsMarkdown(prompts) : exportPromptsAsJSON(prompts)
  const mimeType = format === 'markdown' ? 'text/markdown' : 'application/json'
  const extension = format === 'markdown' ? 'md' : 'json'

  triggerTextDownload(content, `prompt-library.${extension}`, mimeType)
}
