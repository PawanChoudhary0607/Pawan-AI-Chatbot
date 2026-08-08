import { useRef, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { usePromptStore } from '@/state/promptStore'
import { providerRegistry } from '@/providers/registry'
import { useSettingsStore } from '@/state/settingsStore'
import { useModalA11y } from '@/hooks/useModalA11y'
import { useEnterTransition } from '@/hooks/useEnterTransition'
import type { Project } from '@/types/project'

interface ProjectsModalProps {
  onClose: () => void
}

export function ProjectsModal({ onClose }: ProjectsModalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useModalA11y(containerRef, onClose)
  const entered = useEnterTransition()

  const projects = useProjectStore((s) => s.projects)
  const createProject = useProjectStore((s) => s.createProject)
  const updateProject = useProjectStore((s) => s.updateProject)
  const deleteProject = useProjectStore((s) => s.deleteProject)
  const addPromptPreset = useProjectStore((s) => s.addPromptPreset)
  const removePromptPreset = useProjectStore((s) => s.removePromptPreset)

  const prompts = usePromptStore((s) => s.prompts)
  const providers = providerRegistry.list()
  const modelsByProvider = useSettingsStore((s) => s.modelsByProvider)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')

  const selected = selectedId ? projects[selectedId] : undefined
  const projectList = Object.values(projects).sort((a, b) => a.name.localeCompare(b.name))

  const handleCreate = () => {
    if (!newName.trim()) return
    const id = createProject(newName.trim())
    setNewName('')
    setSelectedId(id)
  }

  const patch = (fields: Partial<Project>) => {
    if (!selected) return
    updateProject(selected.id, fields)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Projects"
        className={`flex max-h-[85vh] w-full max-w-2xl rounded-2xl border border-border bg-surface-raised shadow-xl transition-all duration-150 ${
          entered ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <div className="w-48 shrink-0 border-r border-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Projects</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close projects"
              className="text-ink-muted hover:text-ink"
            >
              ✕
            </button>
          </div>
          <div className="mb-2 flex gap-1">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="New project"
              className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-xs text-ink"
            />
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="mb-2 w-full rounded-lg bg-accent px-2 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            + Add
          </button>
          <div className="space-y-0.5">
            {projectList.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => setSelectedId(project.id)}
                className={`block w-full truncate rounded-lg px-2 py-1.5 text-left text-xs ${
                  project.id === selectedId
                    ? 'bg-accent/15 text-ink'
                    : 'text-ink-muted hover:bg-surface hover:text-ink'
                }`}
              >
                {project.name}
              </button>
            ))}
            {projectList.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-ink-faint">No projects yet.</p>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!selected ? (
            <p className="text-sm text-ink-faint">Select or create a project to configure it.</p>
          ) : (
            <div className="space-y-3">
              <label className="block text-xs text-ink-muted">
                Name
                <input
                  value={selected.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-ink"
                />
              </label>
              <label className="block text-xs text-ink-muted">
                Description
                <input
                  value={selected.description ?? ''}
                  onChange={(e) => patch({ description: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-ink"
                />
              </label>
              <label className="block text-xs text-ink-muted">
                Instructions (used as the system prompt for new conversations in this project)
                <textarea
                  value={selected.instructions ?? ''}
                  onChange={(e) => patch({ instructions: e.target.value })}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-ink"
                />
              </label>
              <label className="block text-xs text-ink-muted">
                Default provider
                <select
                  value={selected.defaultProviderId ?? ''}
                  onChange={(e) =>
                    patch({
                      defaultProviderId: e.target.value || undefined,
                      defaultModel: undefined,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-ink"
                >
                  <option value="">(use app default)</option>
                  {providers.map((p) => (
                    <option key={p.meta.id} value={p.meta.id}>
                      {p.meta.name}
                    </option>
                  ))}
                </select>
              </label>
              {selected.defaultProviderId && (
                <label className="block text-xs text-ink-muted">
                  Default model
                  <select
                    value={selected.defaultModel ?? ''}
                    onChange={(e) => patch({ defaultModel: e.target.value || undefined })}
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-ink"
                  >
                    <option value="">(none selected)</option>
                    {(modelsByProvider[selected.defaultProviderId] ?? []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div>
                <p className="mb-1 text-xs text-ink-muted">Prompt presets</p>
                <div className="space-y-1">
                  {selected.promptIds.map((promptId) => {
                    const prompt = prompts.find((p) => p.id === promptId)
                    if (!prompt) return null
                    return (
                      <div
                        key={promptId}
                        className="flex items-center justify-between rounded-lg border border-border px-2 py-1 text-xs"
                      >
                        <span className="truncate text-ink">{prompt.title}</span>
                        <button
                          type="button"
                          onClick={() => removePromptPreset(selected.id, promptId)}
                          aria-label={`Remove preset ${prompt.title}`}
                          className="text-ink-faint hover:text-red-700 dark:hover:text-red-400"
                        >
                          ✕
                        </button>
                      </div>
                    )
                  })}
                </div>
                <select
                  value=""
                  onChange={(e) => e.target.value && addPromptPreset(selected.id, e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1 text-xs text-ink"
                >
                  <option value="">+ Add preset prompt…</option>
                  {prompts
                    .filter((p) => !selected.promptIds.includes(p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  deleteProject(selected.id)
                  setSelectedId(null)
                }}
                className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-700 hover:bg-red-500/10 dark:text-red-400"
              >
                Delete project
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
