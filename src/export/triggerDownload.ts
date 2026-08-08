/** Triggers a browser download of a Blob via a temporary anchor element,
 * then revokes the object URL immediately after — safe to do synchronously
 * right after click() since the browser has already captured the Blob
 * reference for the download by the time click() returns. This is the one
 * place that pattern lives; every export path (conversation, multi-
 * conversation, project, prompt library, ZIP, artifact) calls this instead
 * of re-implementing it. */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** Convenience wrapper for the common case of downloading plain text
 * (Markdown/JSON/etc) rather than an already-constructed Blob. */
export function triggerTextDownload(content: string, filename: string, mimeType: string): void {
  triggerBlobDownload(new Blob([content], { type: mimeType }), filename)
}
