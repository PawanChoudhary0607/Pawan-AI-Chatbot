import { triggerBlobDownload } from '@/export/triggerDownload'

export interface ZipFileEntry {
  name: string
  content: string
}

/** Bundles the given files into a ZIP and triggers a browser download.
 *
 * `jszip` is dynamically imported rather than imported at module scope: it
 * previously got pulled into the main chunk even though it's only ever
 * needed at the moment someone actually clicks an export-as-ZIP button. */
export async function downloadZip(files: ZipFileEntry[], zipFilename: string): Promise<void> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  for (const file of files) {
    zip.file(file.name, file.content)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  triggerBlobDownload(blob, zipFilename)
}
