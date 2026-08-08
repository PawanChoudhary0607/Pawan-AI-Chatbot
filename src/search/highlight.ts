export interface HighlightSegment {
  text: string
  match: boolean
}

/**
 * Splits `text` into segments marking which parts match `query`
 * (case-insensitive substring match). Pure and provider/domain-agnostic —
 * used for highlighting both conversation search and prompt search results.
 * An empty query returns the whole text as a single non-matching segment.
 */
export function highlightMatches(text: string, query: string): HighlightSegment[] {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return [{ text, match: false }]

  const lowerText = text.toLowerCase()
  const lowerQuery = trimmedQuery.toLowerCase()
  const segments: HighlightSegment[] = []

  let cursor = 0
  let index = lowerText.indexOf(lowerQuery, cursor)
  if (index === -1) return [{ text, match: false }]

  while (index !== -1) {
    if (index > cursor) {
      segments.push({ text: text.slice(cursor, index), match: false })
    }
    segments.push({ text: text.slice(index, index + trimmedQuery.length), match: true })
    cursor = index + trimmedQuery.length
    index = lowerText.indexOf(lowerQuery, cursor)
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), match: false })
  }

  return segments
}

/** Convenience boolean check without building segments, for filtering. */
export function textMatches(text: string, query: string): boolean {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return false
  return text.toLowerCase().includes(trimmedQuery.toLowerCase())
}

/** Extracts a short snippet of `text` centered on the first match of
 * `query`, for showing search-result context without dumping an entire
 * message. */
export function extractSnippet(text: string, query: string, contextChars = 40): string {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return text.slice(0, contextChars * 2)

  const index = text.toLowerCase().indexOf(trimmedQuery.toLowerCase())
  if (index === -1) return text.slice(0, contextChars * 2)

  const start = Math.max(0, index - contextChars)
  const end = Math.min(text.length, index + trimmedQuery.length + contextChars)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  return `${prefix}${text.slice(start, end)}${suffix}`
}
