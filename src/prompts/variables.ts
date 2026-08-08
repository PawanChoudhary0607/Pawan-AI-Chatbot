const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

/** Extracts the unique variable names used in a prompt's content, e.g.
 * "Summarize {{text}} in {{style}} style" -> ["text", "style"]. Order
 * matches first appearance; duplicates collapsed. A prompt with no
 * variables returns an empty array — such a prompt is a plain prompt, one
 * with variables is effectively a template, without needing a separate
 * stored "isTemplate" flag that could drift out of sync with the content. */
export function extractVariables(content: string): string[] {
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const match of content.matchAll(VARIABLE_PATTERN)) {
    const name = match[1]
    if (!seen.has(name)) {
      seen.add(name)
      ordered.push(name)
    }
  }
  return ordered
}

export function isTemplate(content: string): boolean {
  return extractVariables(content).length > 0
}

/** Substitutes {{variable}} placeholders with the supplied values. Any
 * variable without a supplied value (or supplied as an empty string) is
 * left as-is in the output, so a partially-filled template is still
 * visibly a template rather than silently losing information. */
export function renderTemplate(content: string, values: Record<string, string>): string {
  return content.replace(VARIABLE_PATTERN, (full, name: string) => {
    const value = values[name]
    return value ? value : full
  })
}
