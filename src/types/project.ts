/**
 * A Project groups conversations under a shared context: a default
 * provider/model for new conversations created inside it, standing
 * instructions (used as those conversations' systemPrompt), and a set of
 * "preset" prompts pinned for quick access while working in the project.
 *
 * Persisted generically via the existing settings key-value channel (same
 * pattern as folders/prompts) — no new storage schema.
 */
export interface Project {
  id: string
  name: string
  description?: string
  defaultProviderId?: string
  defaultModel?: string
  /** Used as the systemPrompt for conversations created within this project. */
  instructions?: string
  /** SavedPrompt ids pinned as quick-access presets for this project. */
  promptIds: string[]
  createdAt: number
  updatedAt: number
}
