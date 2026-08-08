import { extractSnippet, textMatches } from '@/search/highlight'
import type { Conversation } from '@/types/conversation'

export interface ConversationSearchMatch {
  conversationId: string
  titleMatch: boolean
  /** Up to a few short snippets of matching message content, for showing
   * context in search results. */
  messageSnippets: string[]
}

/**
 * Searches conversation titles and message contents for `query`. An empty
 * query returns no matches (callers should just show the unfiltered list in
 * that case, not treat "no query" as "match everything"). Case-insensitive.
 */
export function searchConversations(
  conversations: Conversation[],
  query: string,
  maxSnippetsPerConversation = 3
): ConversationSearchMatch[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  const results: ConversationSearchMatch[] = []

  for (const conversation of conversations) {
    const titleMatch = textMatches(conversation.title, trimmed)
    const messageSnippets: string[] = []

    for (const message of conversation.messages) {
      if (messageSnippets.length >= maxSnippetsPerConversation) break
      if (textMatches(message.content, trimmed)) {
        messageSnippets.push(extractSnippet(message.content, trimmed))
      }
    }

    if (titleMatch || messageSnippets.length > 0) {
      results.push({ conversationId: conversation.id, titleMatch, messageSnippets })
    }
  }

  return results
}
