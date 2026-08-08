import { estimateRequestTokens } from '@/providers/runtimeCapabilities'
import type { Conversation } from '@/types/conversation'

export interface ConversationStatistics {
  totalMessages: number
  userMessages: number
  assistantMessages: number
  totalCharacters: number
  estimatedTokens: number
  attachmentCount: number
  createdAt: number
  updatedAt: number
  providerId: string
  model: string
}

/** Computes summary statistics for a conversation. Token estimation reuses
 * the same character-count heuristic every provider's estimateCost()/
 * estimateContext() already use — one estimation method across the app,
 * not a second one invented for this feature. */
export function computeConversationStatistics(conversation: Conversation): ConversationStatistics {
  const userMessages = conversation.messages.filter((m) => m.role === 'user').length
  const assistantMessages = conversation.messages.filter((m) => m.role === 'assistant').length
  const totalCharacters = conversation.messages.reduce((sum, m) => sum + m.content.length, 0)
  const attachmentCount = conversation.messages.reduce(
    (sum, m) => sum + (m.attachments?.length ?? 0),
    0
  )
  const estimatedTokens = estimateRequestTokens({
    model: conversation.model,
    messages: conversation.messages,
    systemPrompt: conversation.systemPrompt,
  })

  return {
    totalMessages: conversation.messages.length,
    userMessages,
    assistantMessages,
    totalCharacters,
    estimatedTokens,
    attachmentCount,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    providerId: conversation.providerId,
    model: conversation.model,
  }
}
