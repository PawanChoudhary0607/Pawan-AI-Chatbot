import { useRef, useState } from 'react'
import { usePromptStore } from '@/state/promptStore'
import { useConversationStore } from '@/state/conversationStore'
import { useComposerInsertStore } from '@/state/composerInsertStore'
import { searchPrompts } from '@/search/searchPrompts'
import { extractVariables, renderTemplate } from '@/prompts/variables'
import { parseImportedPrompts } from '@/prompts/importExport'
import { downloadPromptLibraryExport } from '@/export/exportPromptLibrary'
import { useModalA11y } from '@/hooks/useModalA11y'
import { useEnterTransition } from '@/hooks/useEnterTransition'
import type { SavedPrompt } from '@/types/prompt'

interface PromptLibraryModalProps {
  onClose: () => void
}

export function PromptLibraryModal({ onClose }: PromptLibraryModalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useModalA11y(containerRef, onClose)
  const entered = useEnterTransition()

  const prompts = usePromptStore((s) => s.prompts)
  const createPrompt = usePromptStore((s) => s.createPrompt)
  const updatePrompt = usePromptStore((s) => s.updatePrompt)
  const deletePrompt = usePromptStore((s) => s.deletePrompt)
  const toggleFavorite = usePromptStore((s) => s.toggleFavorite)
  const restoreVersion = usePromptStore((s) => s.restoreVersion)
  const importPrompts = usePromptStore((s) => s.importPrompts)

  const activeConversationId = useConversationStore((s) => s.activeConversationId)
  const insertPrompt = useComposerInsertStore((s) => s.insert)

  const [query, setQuery] = useState('')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formTags, setFormTags] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null)
  const [variablePromptId, setVariablePromptId] = useState<string | null>(null)
  const [variableValues, setVariableValues] = useState<Record<string, string>>({})
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filtered = searchPrompts(prompts, query).filter((p) => !showFavoritesOnly || p.favorite)
  const categories = Array.from(
    new Set(filtered.map((p) => p.category).filter((c): c is string => Boolean(c)))
  ).sort()
  const uncategorized = filtered.filter((p) => !p.category)

  const resetForm = () => {
    setEditingId(null)
    setIsCreating(false)
    setFormTitle('')
    setFormContent('')
    setFormCategory('')
    setFormTags('')
  }

  const startEditing = (prompt: SavedPrompt) => {
    setEditingId(prompt.id)
    setIsCreating(false)
    setFormTitle(prompt.title)
    setFormContent(prompt.content)
    setFormCategory(prompt.category ?? '')
    setFormTags((prompt.tags ?? []).join(', '))
  }

  const startCreating = () => {
    setIsCreating(true)
    setEditingId(null)
    setFormTitle('')
    setFormContent('')
    setFormCategory('')
    setFormTags('')
  }

  const parseTags = (raw: string) =>
    raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

  const handleSave = () => {
    if (!formTitle.trim() || !formContent.trim()) return
    const tags = parseTags(formTags)
    if (editingId) {
      updatePrompt(editingId, {
        title: formTitle.trim(),
        content: formContent,
        category: formCategory,
        tags: tags.length > 0 ? tags : undefined,
      })
    } else {
      createPrompt(formTitle.trim(), formContent, formCategory, tags)
    }
    resetForm()
  }

  const handleInsertClick = (prompt: SavedPrompt) => {
    if (!activeConversationId) return
    const variables = extractVariables(prompt.content)
    if (variables.length === 0) {
      insertPrompt(activeConversationId, prompt.content)
      onClose()
      return
    }
    setVariablePromptId(prompt.id)
    setVariableValues(Object.fromEntries(variables.map((v) => [v, ''])))
  }

  const handleConfirmVariables = () => {
    const prompt = prompts.find((p) => p.id === variablePromptId)
    if (!prompt || !activeConversationId) return
    insertPrompt(activeConversationId, renderTemplate(prompt.content, variableValues))
    setVariablePromptId(null)
    onClose()
  }

  const handleFileSelected = async (file: File) => {
    const text = await file.text()
    const result = parseImportedPrompts(text)
    if (result.valid.length > 0) {
      importPrompts(result.valid, 'merge')
    }
    setImportError(result.errors.length > 0 ? result.errors.join(' ') : null)
  }

  const isFormOpen = isCreating || editingId !== null
  const variablePrompt = variablePromptId ? prompts.find((p) => p.id === variablePromptId) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Prompt Library"
        className={`flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-surface-raised shadow-xl transition-all duration-150 ${
          entered ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">Prompt Library</h2>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleFileSelected(file)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-border px-2 py-1 text-xs text-ink-muted hover:bg-surface hover:text-ink"
            >
              Import
            </button>
            <button
              type="button"
              onClick={() => void downloadPromptLibraryExport(prompts, 'markdown')}
              className="rounded-lg border border-border px-2 py-1 text-xs text-ink-muted hover:bg-surface hover:text-ink"
            >
              Export MD
            </button>
            <button
              type="button"
              onClick={() => void downloadPromptLibraryExport(prompts, 'json')}
              className="rounded-lg border border-border px-2 py-1 text-xs text-ink-muted hover:bg-surface hover:text-ink"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-ink-muted hover:bg-surface"
              aria-label="Close prompt library"
            >
              ✕
            </button>
          </div>
        </div>

        {importError && (
          <p className="border-b border-border px-5 py-2 text-xs text-red-700 dark:text-red-400">
            {importError}
          </p>
        )}

        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search prompts, tags, categories…"
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint"
          />
          <label className="flex items-center gap-1.5 text-xs text-ink-muted">
            <input
              type="checkbox"
              checked={showFavoritesOnly}
              onChange={(e) => setShowFavoritesOnly(e.target.checked)}
            />
            Favorites only
          </label>
          <button
            type="button"
            onClick={startCreating}
            className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
          >
            + New prompt
          </button>
        </div>

        {isFormOpen && (
          <div className="space-y-2 border-b border-border px-5 py-3">
            <input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Title"
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ink"
            />
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="Prompt content… use {{variable}} for placeholders"
              rows={4}
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ink"
            />
            {extractVariables(formContent).length > 0 && (
              <p className="text-xs text-ink-faint">
                Template variables: {extractVariables(formContent).join(', ')}
              </p>
            )}
            <input
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              placeholder="Category (optional)"
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ink"
            />
            <input
              value={formTags}
              onChange={(e) => setFormTags(e.target.value)}
              placeholder="Tags, comma-separated (optional)"
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ink"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={!formTitle.trim() || !formContent.trim()}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                {editingId ? 'Save changes' : 'Create prompt'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-ink hover:bg-surface"
              >
                Cancel
              </button>
            </div>
            {editingId && (prompts.find((p) => p.id === editingId)?.versions?.length ?? 0) > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setHistoryOpenId(historyOpenId === editingId ? null : editingId)}
                  className="text-xs text-ink-faint underline hover:text-ink-muted"
                >
                  {historyOpenId === editingId ? 'Hide' : 'Show'} version history (
                  {prompts.find((p) => p.id === editingId)?.versions?.length ?? 0})
                </button>
                {historyOpenId === editingId && (
                  <ul className="mt-2 space-y-1">
                    {(prompts.find((p) => p.id === editingId)?.versions ?? []).map((version, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between rounded-lg border border-border px-2 py-1 text-xs"
                      >
                        <span className="truncate text-ink-muted">
                          {version.title} — {new Date(version.savedAt).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            restoreVersion(editingId, i)
                            resetForm()
                          }}
                          className="shrink-0 text-accent-hover hover:underline"
                        >
                          Restore
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {variablePrompt && (
          <div className="space-y-2 border-b border-border bg-surface px-5 py-3">
            <p className="text-xs text-ink-muted">Fill in variables for "{variablePrompt.title}"</p>
            {extractVariables(variablePrompt.content).map((name) => (
              <label key={name} className="block text-xs text-ink-faint">
                {name}
                <input
                  value={variableValues[name] ?? ''}
                  onChange={(e) => setVariableValues((v) => ({ ...v, [name]: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-2 py-1 text-sm text-ink"
                />
              </label>
            ))}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirmVariables}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
              >
                Insert
              </button>
              <button
                type="button"
                onClick={() => setVariablePromptId(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-ink hover:bg-surface-raised"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-ink-faint">
              No prompts yet. Create one to get started.
            </p>
          )}

          {categories.map((category) => (
            <PromptGroup
              key={category}
              label={category}
              prompts={filtered.filter((p) => p.category === category)}
              activeConversationId={activeConversationId}
              onInsert={handleInsertClick}
              onEdit={startEditing}
              onDelete={deletePrompt}
              onToggleFavorite={toggleFavorite}
            />
          ))}
          {uncategorized.length > 0 && (
            <PromptGroup
              label={categories.length > 0 ? 'Uncategorized' : undefined}
              prompts={uncategorized}
              activeConversationId={activeConversationId}
              onInsert={handleInsertClick}
              onEdit={startEditing}
              onDelete={deletePrompt}
              onToggleFavorite={toggleFavorite}
            />
          )}
        </div>
      </div>
    </div>
  )
}

interface PromptGroupProps {
  label?: string
  prompts: SavedPrompt[]
  activeConversationId: string | null
  onInsert: (prompt: SavedPrompt) => void
  onEdit: (prompt: SavedPrompt) => void
  onDelete: (id: string) => void
  onToggleFavorite: (id: string) => void
}

function PromptGroup({
  label,
  prompts,
  activeConversationId,
  onInsert,
  onEdit,
  onDelete,
  onToggleFavorite,
}: PromptGroupProps) {
  if (prompts.length === 0) return null
  return (
    <div className="mb-3">
      {label && (
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {prompts.map((prompt) => {
          const isTemplate = extractVariables(prompt.content).length > 0
          return (
            <div
              key={prompt.id}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
            >
              <button
                type="button"
                onClick={() => onToggleFavorite(prompt.id)}
                aria-label={
                  prompt.favorite ? `Unfavorite ${prompt.title}` : `Favorite ${prompt.title}`
                }
                className="text-ink-faint hover:text-amber-800 dark:hover:text-amber-400"
              >
                {prompt.favorite ? '★' : '☆'}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm text-ink">{prompt.title}</p>
                  {isTemplate && (
                    <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent-hover">
                      Template
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-ink-faint">{prompt.content}</p>
                {prompt.tags && prompt.tags.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {prompt.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] text-ink-faint"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onInsert(prompt)}
                disabled={!activeConversationId}
                className="shrink-0 rounded-lg border border-border px-2 py-1 text-xs text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                title={activeConversationId ? undefined : 'Open a conversation first'}
              >
                Insert
              </button>
              <button
                type="button"
                onClick={() => onEdit(prompt)}
                aria-label={`Edit ${prompt.title}`}
                className="shrink-0 text-ink-faint hover:text-ink"
              >
                ✎
              </button>
              <button
                type="button"
                onClick={() => onDelete(prompt.id)}
                aria-label={`Delete ${prompt.title}`}
                className="shrink-0 text-ink-faint hover:text-red-700 dark:hover:text-red-400"
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
