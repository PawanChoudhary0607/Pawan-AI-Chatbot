import { providerRegistry } from '@/providers/registry'
import type { ManagedAttachment } from '@/attachments/types'

export interface AttachmentCompatibility {
  compatible: boolean
  reason?: string
}

/**
 * Checks whether the given provider can accept an attachment of this kind,
 * using only the generic capability flags every ChatProvider exposes
 * (`vision` for images, `documentInput` for everything else). Never
 * branches on a provider id — a future provider that declares these flags
 * correctly works here with no changes.
 */
export function checkAttachmentCompatibility(
  attachment: ManagedAttachment,
  providerId: string
): AttachmentCompatibility {
  const provider = providerRegistry.get(providerId)
  if (!provider) {
    return { compatible: false, reason: 'Select a provider before sending attachments.' }
  }

  const requiredCapability = attachment.kind === 'image' ? 'vision' : 'documentInput'
  if (!provider.supportsCapability(requiredCapability)) {
    const kindLabel = attachment.kind === 'image' ? 'images' : 'document attachments'
    return { compatible: false, reason: `${provider.meta.name} doesn't support ${kindLabel} yet.` }
  }

  return { compatible: true }
}
