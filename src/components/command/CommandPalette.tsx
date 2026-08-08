import { useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useConversationStore } from '@/state/conversationStore'
import { useSettingsStore } from '@/state/settingsStore'
import { usePromptStore } from '@/state/promptStore'
import { useProjectStore } from '@/state/projectStore'
import { useComposerInsertStore } from '@/state/composerInsertStore'
import { searchConversations } from '@/search/searchConversations'
import { searchPrompts } from '@/search/searchPrompts'
import { searchProjects } from '@/search/searchProjects'
import { searchArtifacts } from '@/search/searchArtifacts'
import { textMatches, highlightMatches } from '@/search/highlight'
import { conversationToPlainText, downloadConversationExport } from '@/export/exportConversation'
import { useModalA11y } from '@/hooks/useModalA11y'
import { useEnterTransition } from '@/hooks/useEnterTransition'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import type { Conversation } from '@/types/conversation'
import type { SavedPrompt } from '@/types/prompt'
import type { Project } from '@/types/project'
import type { Artifact } from '@/types/artifact'

interface CommandPaletteProps {
  onClose: () => void
}

interface PaletteAction {
  id: string
  label: string
  run: () => void
}

type PaletteItem =
  | { kind: 'action'; key: string; action: PaletteAction }
  | { kind: 'conversation'; key: string; conversation: Conversation; titleMatch: boolean }
  | { kind: 'prompt'; key: string; prompt: SavedPrompt }
  | { kind: 'project'; key: string; project: Project }
  | { kind: 'artifact'; key: string; artifact: Artifact }

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useModalA11y(containerRef, onClose)
  const entered = useEnterTransition()

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const conversations = useConversationStore((s) => s.conversations)
  const activeConversationId = useConversationStore((s) => s.activeConversationId)
  const selectConversation = useConversationStore((s) => s.selectConversation)
  const createConversation = useConversationStore((s) => s.createConversation)
  const updateConversationProvider = useConversationStore((s) => s.updateConversationProvider)

  const prompts = usePromptStore((s) => s.prompts)
  const insertPrompt = useComposerInsertStore((s) => s.insert)

  const projects = useProjectStore((s) => s.projects)
  const setActiveProject = useProjectStore((s) => s.setActiveProject)

  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const modelsByProvider = useSettingsStore((s) => s.modelsByProvider)
  const defaultProviderId = useSettingsStore((s) => s.defaultProviderId)
  const defaultModel = useSettingsStore((s) => s.defaultModel)

  const activeConversation = activeConversationId ? conversations[activeConversationId] : undefined
  // The <input> stays bound to `query` directly for instant typing feedback;
  // everything downstream of the search (results, highlighting, the "no
  // matches" text) reads the debounced value instead. Artifact search in
  // particular re-extracts artifacts from every non-archived conversation —
  // running that on every single keystroke was a real, measured cost that
  // only gets worse as conversation/message count grows.
  const debouncedQuery = useDebouncedValue(query, 150)
  const trimmedQuery = debouncedQuery.trim()

  const items: PaletteItem[] = useMemo(() => {
    const actions: PaletteAction[] = [
      {
        id: 'new-chat',
        label: 'New conversation',
        run: () => {
          createConversation(defaultProviderId ?? '', defaultModel ?? '')
          onClose()
        },
      },
      {
        id: 'toggle-theme',
        label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        run: () => {
          setTheme(theme === 'dark' ? 'light' : 'dark')
          onClose()
        },
      },
    ]

    if (activeConversation) {
      actions.push(
        {
          id: 'copy-conversation',
          label: 'Copy entire conversation',
          run: () => {
            void navigator.clipboard.writeText(conversationToPlainText(activeConversation))
            onClose()
          },
        },
        {
          id: 'export-markdown',
          label: 'Export conversation as Markdown',
          run: () => {
            downloadConversationExport(activeConversation, 'markdown')
            onClose()
          },
        },
        {
          id: 'export-json',
          label: 'Export conversation as JSON',
          run: () => {
            downloadConversationExport(activeConversation, 'json')
            onClose()
          },
        }
      )

      const models = modelsByProvider[activeConversation.providerId] ?? []
      for (const model of models) {
        if (model.id === activeConversation.model) continue
        actions.push({
          id: `model-${model.id}`,
          label: `Switch model to ${model.name}`,
          run: () => {
            updateConversationProvider(
              activeConversation.id,
              activeConversation.providerId,
              model.id
            )
            onClose()
          },
        })
      }
    }

    const filteredActions = trimmedQuery
      ? actions.filter((a) => textMatches(a.label, trimmedQuery))
      : actions

    const conversationMatches = trimmedQuery
      ? searchConversations(
          Object.values(conversations).filter((c) => !c.archived),
          trimmedQuery
        )
      : []

    const promptMatches = trimmedQuery ? searchPrompts(prompts, trimmedQuery) : []
    const projectMatches = trimmedQuery ? searchProjects(Object.values(projects), trimmedQuery) : []
    const artifactMatches = trimmedQuery
      ? searchArtifacts(
          Object.values(conversations).filter((c) => !c.archived),
          trimmedQuery
        ).slice(0, 10) // bounded: artifact extraction runs across every conversation
      : []

    return [
      ...filteredActions.map((action): PaletteItem => ({ kind: 'action', key: action.id, action })),
      ...conversationMatches.map((match): PaletteItem => ({
        kind: 'conversation',
        key: match.conversationId,
        conversation: conversations[match.conversationId],
        titleMatch: match.titleMatch,
      })),
      ...projectMatches.map((project): PaletteItem => ({
        kind: 'project',
        key: project.id,
        project,
      })),
      ...promptMatches.map((prompt): PaletteItem => ({ kind: 'prompt', key: prompt.id, prompt })),
      ...artifactMatches.map((artifact): PaletteItem => ({
        kind: 'artifact',
        key: artifact.id,
        artifact,
      })),
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedQuery, conversations, prompts, projects, activeConversation, theme, modelsByProvider])

  const runItem = (item: PaletteItem) => {
    if (item.kind === 'action') {
      item.action.run()
    } else if (item.kind === 'conversation') {
      selectConversation(item.conversation.id)
      onClose()
    } else if (item.kind === 'prompt' && activeConversationId) {
      insertPrompt(activeConversationId, item.prompt.content)
      onClose()
    } else if (item.kind === 'project') {
      setActiveProject(item.project.id)
      onClose()
    } else if (item.kind === 'artifact') {
      selectConversation(item.artifact.conversationId)
      onClose()
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, Math.max(items.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = items[selectedIndex]
      if (item) runItem(item)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const grouped: Array<{ label: string; items: Array<{ item: PaletteItem; index: number }> }> = []
  const GROUP_LABELS: Record<PaletteItem['kind'], string> = {
    action: 'Actions',
    conversation: 'Conversations',
    project: 'Projects',
    prompt: 'Prompts',
    artifact: 'Artifacts',
  }
  for (const kind of ['action', 'conversation', 'project', 'prompt', 'artifact'] as const) {
    const groupItems = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.kind === kind)
    if (groupItems.length === 0) continue
    grouped.push({ label: GROUP_LABELS[kind], items: groupItems })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-24">
      <div
        ref={containerRef}
        className={`w-full max-w-lg rounded-2xl border border-border bg-surface-raised shadow-xl transition-all duration-150 ${
          entered ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelectedIndex(0)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search conversations, prompts, or type a command…"
          className="w-full rounded-t-2xl border-b border-border bg-transparent px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-inset focus:ring-accent"
        />

        <div className="max-h-96 overflow-y-auto p-2">
          {items.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-ink-faint">
              {trimmedQuery ? 'No matches.' : 'Type to search, or pick an action below.'}
            </p>
          )}
          {grouped.map((group) => (
            <div key={group.label} className="mb-2">
              <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                {group.label}
              </p>
              {group.items.map(({ item, index }) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => runItem(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`block w-full truncate rounded-lg px-3 py-2 text-left text-sm ${
                    index === selectedIndex
                      ? 'bg-accent/15 text-ink'
                      : 'text-ink-muted hover:bg-surface hover:text-ink'
                  }`}
                >
                  {item.kind === 'action' && item.action.label}
                  {item.kind === 'conversation' && (
                    <ConversationResultLabel
                      conversation={item.conversation}
                      query={trimmedQuery}
                    />
                  )}
                  {item.kind === 'project' && <span>{item.project.name}</span>}
                  {item.kind === 'prompt' && (
                    <span>
                      {item.prompt.favorite ? '★ ' : ''}
                      {item.prompt.title}
                    </span>
                  )}
                  {item.kind === 'artifact' && (
                    <span className="flex items-center gap-2">
                      <span className="shrink-0 rounded-full bg-surface px-1.5 py-0.5 text-[10px] uppercase text-ink-faint">
                        {item.artifact.kind}
                      </span>
                      {item.artifact.title}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
      {/* Backdrop closes the palette on outside click. */}
      <div className="fixed inset-0 -z-10" onClick={onClose} aria-hidden="true" />
    </div>
  )
}

function ConversationResultLabel({
  conversation,
  query,
}: {
  conversation: Conversation
  query: string
}) {
  const segments = highlightMatches(conversation.title, query)
  return (
    <span>
      {segments.map((segment, i) => (
        <span key={i} className={segment.match ? 'bg-accent/30 text-ink' : undefined}>
          {segment.text}
        </span>
      ))}
    </span>
  )
}
