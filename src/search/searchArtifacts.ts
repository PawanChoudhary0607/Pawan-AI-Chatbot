import { textMatches } from '@/search/highlight'
import { extractArtifactsFromConversation } from '@/artifacts/extractArtifacts'
import type { Conversation } from '@/types/conversation'
import type { Artifact } from '@/types/artifact'

/** Searches artifacts extracted from the given conversations. Artifacts are
 * always derived on demand (see extractArtifacts.ts), so this simply
 * extracts-then-filters rather than querying some separately-stored index. */
export function searchArtifacts(conversations: Conversation[], query: string): Artifact[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  const results: Artifact[] = []
  for (const conversation of conversations) {
    const artifacts = extractArtifactsFromConversation(conversation)
    for (const artifact of artifacts) {
      if (textMatches(artifact.title, trimmed) || textMatches(artifact.content, trimmed)) {
        results.push(artifact)
      }
    }
  }
  return results
}
