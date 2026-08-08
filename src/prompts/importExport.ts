import type { SavedPrompt } from '@/types/prompt'

export function exportPromptsAsJSON(prompts: SavedPrompt[]): string {
  return JSON.stringify(prompts, null, 2)
}

export function exportPromptsAsMarkdown(prompts: SavedPrompt[]): string {
  const lines: string[] = ['# Prompt Library', '']
  for (const prompt of prompts) {
    lines.push(`## ${prompt.title}`, '')
    if (prompt.category) lines.push(`**Category:** ${prompt.category}`, '')
    if (prompt.tags && prompt.tags.length > 0) lines.push(`**Tags:** ${prompt.tags.join(', ')}`, '')
    lines.push('```', prompt.content, '```', '')
  }
  return lines.join('\n')
}

export interface PromptImportResult {
  valid: SavedPrompt[]
  errors: string[]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Validates and normalizes prompts imported from JSON. Deliberately
 * tolerant: a file with some malformed entries still imports the valid
 * ones rather than failing the whole batch, with the specific problems
 * reported back so the caller can show them. */
export function parseImportedPrompts(json: string): PromptImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { valid: [], errors: ['File is not valid JSON.'] }
  }

  const candidates = Array.isArray(parsed) ? parsed : [parsed]
  const valid: SavedPrompt[] = []
  const errors: string[] = []
  const now = Date.now()

  candidates.forEach((candidate, index) => {
    if (!isPlainObject(candidate)) {
      errors.push(`Entry ${index + 1}: not an object.`)
      return
    }
    const title = candidate.title
    const content = candidate.content
    if (typeof title !== 'string' || !title.trim()) {
      errors.push(`Entry ${index + 1}: missing or invalid "title".`)
      return
    }
    if (typeof content !== 'string' || !content.trim()) {
      errors.push(`Entry ${index + 1}: missing or invalid "content".`)
      return
    }
    valid.push({
      id: crypto.randomUUID(), // always assign a fresh id — never trust an imported id blindly, avoids collisions
      title,
      content,
      category: typeof candidate.category === 'string' ? candidate.category : undefined,
      tags: Array.isArray(candidate.tags)
        ? candidate.tags.filter((t) => typeof t === 'string')
        : undefined,
      favorite: false,
      createdAt: now,
      updatedAt: now,
    })
  })

  return { valid, errors }
}
