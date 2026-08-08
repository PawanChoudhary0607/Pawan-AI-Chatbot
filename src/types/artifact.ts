export type ArtifactKind = 'markdown' | 'code' | 'json' | 'table' | 'attachment'

/**
 * An Artifact is a distinct, extractable piece of content found inside an
 * assistant message — a fenced code block, a JSON blob, a GFM table, a
 * larger markdown document, or an attachment. Artifacts are deliberately
 * NOT their own persisted entity: they're computed on demand from
 * `conversation.messages` (see src/artifacts/extractArtifacts.ts), so they
 * can never drift out of sync with the conversation and require zero new
 * storage. "Remains linked to its originating conversation" falls out for
 * free since every artifact carries the ids it was extracted from.
 */
export interface Artifact {
  id: string
  conversationId: string
  messageId: string
  kind: ArtifactKind
  title: string
  content: string
  /** Only meaningful for kind: 'code'. */
  language?: string
  createdAt: number
}
