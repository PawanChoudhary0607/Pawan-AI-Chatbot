import type { AttachmentKind } from '@/attachments/types'

const BINARY_KINDS: ReadonlySet<AttachmentKind> = new Set(['image', 'pdf'])

/**
 * Reads a browser File into the string format the pipeline expects for
 * `markProcessed()`: base64 for binary kinds (image/pdf), raw text for
 * everything else (markdown/text/csv/json/code/custom). The pipeline
 * itself has no knowledge of FileReader — this keeps it testable in any
 * environment, per its own design doc comment.
 */
export function readFileForPipeline(file: File, kind: AttachmentKind): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))

    if (BINARY_KINDS.has(kind)) {
      reader.onload = () => {
        const result = reader.result as string // "data:<mime>;base64,<data>"
        const base64 = result.split(',')[1] ?? ''
        resolve(base64)
      }
      reader.readAsDataURL(file)
    } else {
      reader.onload = () => resolve((reader.result as string) ?? '')
      reader.readAsText(file)
    }
  })
}
