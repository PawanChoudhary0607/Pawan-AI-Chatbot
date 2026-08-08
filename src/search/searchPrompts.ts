import { textMatches } from '@/search/highlight'
import type { SavedPrompt } from '@/types/prompt'

/**
 * Searches saved prompts by title, content, and category. An empty query
 * returns every prompt (unlike searchConversations) since the Prompt
 * Library is meant to browse-then-narrow, not require typing first.
 */
export function searchPrompts(prompts: SavedPrompt[], query: string): SavedPrompt[] {
  const trimmed = query.trim()
  if (!trimmed) return prompts

  return prompts.filter(
    (prompt) =>
      textMatches(prompt.title, trimmed) ||
      textMatches(prompt.content, trimmed) ||
      (prompt.category ? textMatches(prompt.category, trimmed) : false) ||
      (prompt.tags ?? []).some((tag) => textMatches(tag, trimmed))
  )
}
