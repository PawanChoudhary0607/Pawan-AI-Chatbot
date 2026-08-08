import { useState } from 'react'
import { useSettingsStore } from '@/state/settingsStore'
import { useCloseOnEscape } from '@/hooks/useCloseOnEscape'
import type { ModelInfo } from '@/types/provider'

interface ModelPickerPrefs {
  favorites: Record<string, string[]>
  recents: Record<string, string[]>
}

const EMPTY_PREFS: ModelPickerPrefs = { favorites: {}, recents: {} }
const MAX_RECENTS = 5

function useModelPickerPrefs() {
  const uiPreferences = useSettingsStore((s) => s.uiPreferences)
  const setUiPreference = useSettingsStore((s) => s.setUiPreference)
  const prefs = (uiPreferences.modelPicker as ModelPickerPrefs | undefined) ?? EMPTY_PREFS

  const toggleFavorite = (providerId: string, modelId: string) => {
    const current = prefs.favorites[providerId] ?? []
    const next = current.includes(modelId)
      ? current.filter((id) => id !== modelId)
      : [...current, modelId]
    setUiPreference('modelPicker', {
      ...prefs,
      favorites: { ...prefs.favorites, [providerId]: next },
    })
  }

  const recordRecent = (providerId: string, modelId: string) => {
    const current = prefs.recents[providerId] ?? []
    const next = [modelId, ...current.filter((id) => id !== modelId)].slice(0, MAX_RECENTS)
    setUiPreference('modelPicker', {
      ...prefs,
      recents: { ...prefs.recents, [providerId]: next },
    })
  }

  return { favorites: prefs.favorites, recents: prefs.recents, toggleFavorite, recordRecent }
}

type SortMode = 'name' | 'context'

interface ModelPickerProps {
  providerId: string
  models: ModelInfo[]
  selectedModelId: string
  onSelect: (modelId: string) => void
  disabled?: boolean
  loading?: boolean
}

export function ModelPicker({
  providerId,
  models,
  selectedModelId,
  onSelect,
  disabled,
  loading,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false)
  useCloseOnEscape(open, () => setOpen(false))
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('name')
  const { favorites, recents, toggleFavorite, recordRecent } = useModelPickerPrefs()

  const favoriteIds = new Set(favorites[providerId] ?? [])
  const recentIds = recents[providerId] ?? []
  const selectedModel = models.find((m) => m.id === selectedModelId)

  const filtered = models.filter((m) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === 'context') return (b.contextWindow ?? 0) - (a.contextWindow ?? 0)
    return a.name.localeCompare(b.name)
  })

  const favoriteModels = sorted.filter((m) => favoriteIds.has(m.id))
  const recentModels = recentIds
    .map((id) => sorted.find((m) => m.id === id))
    .filter((m): m is ModelInfo => m !== undefined && !favoriteIds.has(m.id))
  const recentIdSet = new Set(recentModels.map((m) => m.id))
  const restModels = sorted.filter((m) => !favoriteIds.has(m.id) && !recentIdSet.has(m.id))

  const handleSelect = (modelId: string) => {
    onSelect(modelId)
    recordRecent(providerId, modelId)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="min-w-[140px] rounded-lg border border-border bg-surface-raised px-2 py-1 text-left text-xs text-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? 'Loading models…' : (selectedModel?.name ?? 'Select model…')}
      </button>

      {open && (
        <>
          {/* Backdrop closes the popover on outside click, same pattern as SettingsModal. */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 z-20 mt-1 w-72 rounded-xl border border-border bg-surface-raised p-2 shadow-xl">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search models…"
              className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-ink placeholder:text-ink-faint"
            />
            <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-faint">
              <span>Sort:</span>
              <button
                type="button"
                onClick={() => setSortMode('name')}
                className={sortMode === 'name' ? 'font-medium text-ink' : 'hover:text-ink-muted'}
              >
                Name
              </button>
              <button
                type="button"
                onClick={() => setSortMode('context')}
                className={sortMode === 'context' ? 'font-medium text-ink' : 'hover:text-ink-muted'}
              >
                Context size
              </button>
            </div>

            <div className="mt-2 max-h-64 overflow-y-auto">
              <ModelGroup
                label="Favorites"
                models={favoriteModels}
                selectedModelId={selectedModelId}
                favoriteIds={favoriteIds}
                onSelect={handleSelect}
                onToggleFavorite={(id) => toggleFavorite(providerId, id)}
              />
              <ModelGroup
                label="Recent"
                models={recentModels}
                selectedModelId={selectedModelId}
                favoriteIds={favoriteIds}
                onSelect={handleSelect}
                onToggleFavorite={(id) => toggleFavorite(providerId, id)}
              />
              <ModelGroup
                label={favoriteModels.length || recentModels.length ? 'All models' : undefined}
                models={restModels}
                selectedModelId={selectedModelId}
                favoriteIds={favoriteIds}
                onSelect={handleSelect}
                onToggleFavorite={(id) => toggleFavorite(providerId, id)}
              />
              {sorted.length === 0 && (
                <p className="px-2 py-4 text-center text-xs text-ink-faint">No models match.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

interface ModelGroupProps {
  label?: string
  models: ModelInfo[]
  selectedModelId: string
  favoriteIds: Set<string>
  onSelect: (modelId: string) => void
  onToggleFavorite: (modelId: string) => void
}

function ModelGroup({
  label,
  models,
  selectedModelId,
  favoriteIds,
  onSelect,
  onToggleFavorite,
}: ModelGroupProps) {
  if (models.length === 0) return null
  return (
    <div className="mb-2">
      {label && (
        <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
          {label}
        </p>
      )}
      {models.map((m) => (
        <div key={m.id} className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSelect(m.id)}
            className={`flex-1 truncate rounded-lg px-2 py-1.5 text-left text-xs ${
              m.id === selectedModelId
                ? 'bg-accent/15 text-ink'
                : 'text-ink-muted hover:bg-surface hover:text-ink'
            }`}
          >
            {m.name}
          </button>
          <button
            type="button"
            onClick={() => onToggleFavorite(m.id)}
            aria-label={favoriteIds.has(m.id) ? 'Remove from favorites' : 'Add to favorites'}
            className="px-1.5 text-xs text-ink-faint hover:text-amber-800 dark:hover:text-amber-400"
          >
            {favoriteIds.has(m.id) ? '★' : '☆'}
          </button>
        </div>
      ))}
    </div>
  )
}
