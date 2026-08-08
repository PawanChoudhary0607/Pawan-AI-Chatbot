import { useEffect, useState } from 'react'
import { providerRegistry } from '@/providers/registry'
import { useConversationStore } from '@/state/conversationStore'
import { useSettingsStore } from '@/state/settingsStore'
import { ConnectionStatusBadge } from '@/components/settings/ConnectionStatusBadge'
import { ModelPicker } from '@/components/chat/ModelPicker'

interface ProviderModelSelectorProps {
  conversationId: string
  providerId: string
  model: string
}

export function ProviderModelSelector({
  conversationId,
  providerId,
  model,
}: ProviderModelSelectorProps) {
  const providers = providerRegistry.list()
  const credentials = useSettingsStore((s) => s.credentials)
  const modelsByProvider = useSettingsStore((s) => s.modelsByProvider)
  const validation = useSettingsStore((s) => s.validation)
  const setModels = useSettingsStore((s) => s.setModels)
  const updateConversationProvider = useConversationStore((s) => s.updateConversationProvider)

  const selectedProvider = providers.find((p) => p.meta.id === providerId)
  const models = modelsByProvider[providerId] ?? []
  const [loadingModels, setLoadingModels] = useState(false)

  const hasCredentials = selectedProvider
    ? !selectedProvider.meta.requiresKey || Boolean(credentials[providerId]?.apiKey)
    : false

  // Loads the model list whenever the provider, credential presence, or the
  // credential value itself changes — e.g. correcting a typo in an
  // already-entered API key now correctly triggers a refetch with the
  // fixed key, which the previous (narrower) dependency array didn't do.
  // `credentials[providerId]?.apiKey` (not the whole `credentials` object)
  // keeps this from re-running on unrelated provider's credential edits.
  useEffect(() => {
    if (!selectedProvider || !hasCredentials || loadingModels) return
    setLoadingModels(true)
    selectedProvider
      .listModels(credentials[providerId] ?? {})
      .then((list) => setModels(providerId, list))
      .catch(() => {
        // Model load failures surface via the settings validation state
        // instead of here — this selector just stays empty and disabled.
      })
      .finally(() => setLoadingModels(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, hasCredentials, credentials[providerId]?.apiKey])

  return (
    <div className="flex items-center gap-2 text-xs">
      <select
        value={providerId}
        onChange={(e) => updateConversationProvider(conversationId, e.target.value, '')}
        className="rounded-lg border border-border bg-surface-raised px-2 py-1 text-ink"
      >
        <option value="" disabled>
          Select provider…
        </option>
        {providers.map((p) => (
          <option key={p.meta.id} value={p.meta.id}>
            {p.meta.name}
          </option>
        ))}
      </select>

      <ModelPicker
        providerId={providerId}
        models={models}
        selectedModelId={model}
        disabled={!selectedProvider || !hasCredentials}
        loading={loadingModels}
        onSelect={(modelId) => updateConversationProvider(conversationId, providerId, modelId)}
      />

      {selectedProvider && !hasCredentials && (
        <span className="text-ink-faint">Add an API key in Settings</span>
      )}
      {selectedProvider && <ConnectionStatusBadge state={validation[providerId]} />}
    </div>
  )
}
