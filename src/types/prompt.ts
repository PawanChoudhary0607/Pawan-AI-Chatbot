/** A snapshot of a prompt's title/content before an edit overwrote them —
 * pushed onto SavedPrompt.versions every time updatePrompt() changes either
 * field, so prior wording is never silently lost. */
export interface PromptVersion {
  title: string
  content: string
  savedAt: number
}

export interface SavedPrompt {
  id: string
  title: string
  content: string
  category?: string
  /** Free-text tags, distinct from `category` (one category, many tags). */
  tags?: string[]
  favorite: boolean
  /** Prior versions, most recent first. Empty/undefined for a prompt that
   * has never been edited since creation. */
  versions?: PromptVersion[]
  createdAt: number
  updatedAt: number
}
