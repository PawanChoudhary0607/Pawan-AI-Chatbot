import { create } from 'zustand'
import { eventBus } from '@/events/eventBus'
import type { ModelInfo, ProviderCredentials } from '@/types/provider'

export type AppTheme = 'light' | 'dark' | 'minimal' | 'neumorphism' | 'skeuomorphism'

export type ProviderValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid'

export interface ProviderValidationState {
  status: ProviderValidationStatus
  message?: string
}

export interface SettingsState {
  theme: AppTheme
  defaultProviderId: string | null
  defaultModel: string | null
  /** Keyed by providerId. Persisted to storage, browser-local only — never
   * sent anywhere by the app itself. */
  credentials: Record<string, ProviderCredentials>
  /** Open-ended bag for small UI preferences (sidebar collapsed, composer
   * height, etc) so new preferences don't need a new store field + a
   * storage migration every time. */
  uiPreferences: Record<string, unknown>

  /** Ephemeral, session-only, intentionally NOT persisted: cached model
   * lists per provider (re-fetched each session) and key-validation status
   * shown in the settings UI. */
  modelsByProvider: Record<string, ModelInfo[]>
  validation: Record<string, ProviderValidationState>

  /** Populates state from storage at app startup. Does NOT emit events —
   * see conversationStore.hydrate for why. */
  hydrate: (
    partial: Partial<
      Pick<
        SettingsState,
        'theme' | 'defaultProviderId' | 'defaultModel' | 'credentials' | 'uiPreferences'
      >
    >
  ) => void

  setTheme: (theme: AppTheme) => void
  setDefaultProvider: (providerId: string, model: string) => void
  setCredentials: (providerId: string, credentials: ProviderCredentials) => void
  setUiPreference: (key: string, value: unknown) => void
  setModels: (providerId: string, models: ModelInfo[]) => void
  setValidation: (providerId: string, state: ProviderValidationState) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'dark',
  defaultProviderId: null,
  defaultModel: null,
  credentials: {},
  uiPreferences: {},
  modelsByProvider: {},
  validation: {},

  hydrate: (partial) => {
    set(partial)
  },

  setTheme: (theme) => {
    set({ theme })
    eventBus.emit('theme.changed', { theme })
  },

  setDefaultProvider: (providerId, model) => {
    set({ defaultProviderId: providerId, defaultModel: model })
    eventBus.emit('settings.updated', { key: 'defaultProvider' })
  },

  setCredentials: (providerId, credentials) => {
    set((state) => ({
      credentials: { ...state.credentials, [providerId]: credentials },
    }))
    eventBus.emit('settings.updated', { key: `credentials:${providerId}` })
  },

  setUiPreference: (key, value) => {
    set((state) => ({
      uiPreferences: { ...state.uiPreferences, [key]: value },
    }))
    eventBus.emit('settings.updated', { key: `uiPreference:${key}` })
  },

  setModels: (providerId, models) => {
    set((state) => ({
      modelsByProvider: { ...state.modelsByProvider, [providerId]: models },
    }))
  },

  setValidation: (providerId, validationState) => {
    set((state) => ({
      validation: { ...state.validation, [providerId]: validationState },
    }))
    if (validationState.status === 'invalid') {
      eventBus.emit('provider.keyInvalid', { providerId, message: validationState.message })
    } else if (validationState.status === 'valid') {
      eventBus.emit('provider.keyValidated', { providerId })
    }
  },
}))
