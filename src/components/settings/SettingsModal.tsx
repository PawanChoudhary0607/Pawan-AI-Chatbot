import { useRef, useState } from 'react'
import { providerRegistry } from '@/providers/registry'
import { useSettingsStore } from '@/state/settingsStore'
import { ConnectionStatusBadge } from '@/components/settings/ConnectionStatusBadge'
import { ThemeSelector } from '@/components/settings/ThemeSelector'
import { useModalA11y } from '@/hooks/useModalA11y'
import { useEnterTransition } from '@/hooks/useEnterTransition'
import type { ChatProvider, ProviderCredentials } from '@/types/provider'

interface SettingsModalProps {
  onClose: () => void
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useModalA11y(containerRef, onClose)
  const entered = useEnterTransition()

  const providers = providerRegistry.list()
  const credentials = useSettingsStore((s) => s.credentials)
  const setCredentials = useSettingsStore((s) => s.setCredentials)
  const validation = useSettingsStore((s) => s.validation)
  const setValidation = useSettingsStore((s) => s.setValidation)
  const setModels = useSettingsStore((s) => s.setModels)
  const modelsByProvider = useSettingsStore((s) => s.modelsByProvider)

  const [drafts, setDrafts] = useState<Record<string, ProviderCredentials>>(() =>
    Object.fromEntries(providers.map((p) => [p.meta.id, { ...(credentials[p.meta.id] ?? {}) }]))
  )

  const updateDraftField = (providerId: string, fieldKey: string, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [providerId]: { ...prev[providerId], [fieldKey]: value },
    }))
  }

  /** Runs validateKey + (on success) listModels against a given set of
   * credentials. Shared by both "Save & Connect" and "Test Connection" so
   * the two actions behave identically — the only difference is which
   * credentials they check (draft vs. last-saved) and whether they save. */
  const runConnectionTest = async (provider: ChatProvider, creds: ProviderCredentials) => {
    setValidation(provider.meta.id, { status: 'validating' })
    const result = await provider.validateKey(creds)
    if (!result.valid) {
      setValidation(provider.meta.id, { status: 'invalid', message: result.message })
      return
    }
    setValidation(provider.meta.id, { status: 'valid' })
    try {
      const models = await provider.listModels(creds)
      setModels(provider.meta.id, models)
    } catch {
      // Key/connection is valid but the model list failed to load — leave
      // validation as 'valid' and let the model picker's empty state
      // communicate the rest; nothing here should be fatal.
    }
  }

  const handleSaveAndConnect = async (provider: ChatProvider) => {
    const creds = drafts[provider.meta.id] ?? {}
    setCredentials(provider.meta.id, creds)
    await runConnectionTest(provider, creds)
  }

  const handleTestConnection = async (provider: ChatProvider) => {
    // Deliberately tests the last-SAVED credentials, not unsaved draft
    // edits — this is "is what I already configured still working right
    // now", e.g. re-checking a local Ollama server after restarting it.
    const savedCreds = credentials[provider.meta.id] ?? {}
    await runConnectionTest(provider, savedCreds)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className={`max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface-raised p-5 shadow-xl transition-all duration-150 ${
          entered ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-ink-muted hover:bg-surface"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <p className="mb-2 text-xs font-medium text-ink-muted">Theme</p>
          <ThemeSelector />
        </div>

        {providers.length === 0 ? (
          <p className="text-sm text-ink-muted">No providers are registered yet.</p>
        ) : (
          <div className="space-y-4">
            {providers.map((provider) => {
              const state = validation[provider.meta.id]
              const modelCount = modelsByProvider[provider.meta.id]?.length ?? 0
              const isBusy = state?.status === 'validating'
              return (
                <div key={provider.meta.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-ink">{provider.meta.name}</p>
                    {provider.meta.docsUrl && (
                      <a
                        href={provider.meta.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-ink-faint hover:text-ink-muted"
                      >
                        Docs
                      </a>
                    )}
                  </div>
                  {provider.meta.description && (
                    <p className="mt-1 text-xs text-ink-faint">{provider.meta.description}</p>
                  )}

                  {provider.meta.credentialFields.map((field) => (
                    <label key={field.key} className="mt-2 block text-xs text-ink-muted">
                      {field.label}
                      <input
                        type={field.type === 'apiKey' ? 'password' : 'text'}
                        placeholder={field.placeholder}
                        value={drafts[provider.meta.id]?.[field.key] ?? ''}
                        onChange={(e) =>
                          updateDraftField(provider.meta.id, field.key, e.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-ink"
                      />
                    </label>
                  ))}
                  {!provider.meta.requiresKey && (
                    <p className="mt-1 text-xs text-ink-faint">
                      No API key required — leave blank to use the default, or click Test Connection
                      to check it's reachable.
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleSaveAndConnect(provider)}
                      disabled={isBusy}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isBusy ? 'Validating…' : 'Save & Connect'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleTestConnection(provider)}
                      disabled={isBusy}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Test Connection
                    </button>
                    <ConnectionStatusBadge state={state} />
                    {state?.status === 'valid' && modelCount > 0 && (
                      <span className="text-xs text-ink-faint">{modelCount} models</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="mt-4 text-xs text-ink-faint">
          Keys are stored only in this browser. Nothing is sent to any server we operate.
        </p>
      </div>
    </div>
  )
}
