import { useState } from 'react'
import { useConversationStore } from '@/state/conversationStore'
import { useSettingsStore } from '@/state/settingsStore'
import { useProjectStore } from '@/state/projectStore'
import { searchConversations } from '@/search/searchConversations'
import { highlightMatches } from '@/search/highlight'
import { useCloseOnEscape } from '@/hooks/useCloseOnEscape'
import { useCreateConversationInContext } from '@/hooks/useCreateConversationInContext'
import { downloadConversationsExport } from '@/export/exportMultipleConversations'
import type { Conversation, ConversationSortMode } from '@/types/conversation'

interface SidebarProps {
  mobileOpen: boolean
  onCloseMobile: () => void
  onOpenSettings: () => void
  onOpenPromptLibrary: () => void
  onOpenProjects: () => void
}

const SORT_LABELS: Record<ConversationSortMode, string> = {
  updatedAt: 'Last activity',
  lastOpenedAt: 'Recently opened',
  title: 'Title (A–Z)',
  createdAt: 'Date created',
}

function sortConversations(items: Conversation[], mode: ConversationSortMode): Conversation[] {
  const sorted = [...items]
  if (mode === 'title') return sorted.sort((a, b) => a.title.localeCompare(b.title))
  if (mode === 'createdAt') return sorted.sort((a, b) => b.createdAt - a.createdAt)
  if (mode === 'lastOpenedAt') return sorted.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
  return sorted.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function Sidebar({
  mobileOpen,
  onCloseMobile,
  onOpenSettings,
  onOpenPromptLibrary,
  onOpenProjects,
}: SidebarProps) {
  const conversations = useConversationStore((s) => s.conversations)
  const activeId = useConversationStore((s) => s.activeConversationId)
  const selectConversation = useConversationStore((s) => s.selectConversation)
  const renameConversation = useConversationStore((s) => s.renameConversation)
  const deleteConversation = useConversationStore((s) => s.deleteConversation)
  const togglePinned = useConversationStore((s) => s.togglePinned)
  const toggleArchived = useConversationStore((s) => s.toggleArchived)
  const setConversationFolder = useConversationStore((s) => s.setConversationFolder)
  const folders = useConversationStore((s) => s.folders)
  const createFolder = useConversationStore((s) => s.createFolder)
  const createConversationInContext = useCreateConversationInContext()

  const projects = useProjectStore((s) => s.projects)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const setActiveProject = useProjectStore((s) => s.setActiveProject)

  const uiPreferences = useSettingsStore((s) => s.uiPreferences)
  const setUiPreference = useSettingsStore((s) => s.setUiPreference)

  const [searchQuery, setSearchQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  useCloseOnEscape(menuOpenId !== null, () => setMenuOpenId(null))
  const [isAddingFolder, setIsAddingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const sortMode =
    (uiPreferences.conversationSort as ConversationSortMode | undefined) ?? 'updatedAt'
  const setSortMode = (mode: ConversationSortMode) => setUiPreference('conversationSort', mode)

  const allConversations = Object.values(conversations)
  const inActiveProject = activeProjectId
    ? allConversations.filter((c) => c.projectId === activeProjectId)
    : allConversations
  const active = inActiveProject.filter((c) => !c.archived)
  const archived = inActiveProject.filter((c) => c.archived)
  const projectList = Object.values(projects).sort((a, b) => a.name.localeCompare(b.name))

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleExportSelected = async (format: 'markdown' | 'json' | 'zip') => {
    const selected = allConversations.filter((c) => selectedIds.has(c.id))
    await downloadConversationsExport(selected, format)
  }

  const trimmedQuery = searchQuery.trim()
  const searchMatches = trimmedQuery ? searchConversations(active, trimmedQuery) : []
  const searchMatchIds = new Set(searchMatches.map((m) => m.conversationId))

  const pinned = sortConversations(
    active.filter((c) => c.pinned),
    sortMode
  )
  const unfiled = sortConversations(
    active.filter((c) => !c.pinned && !c.folderId),
    sortMode
  )
  const folderList = Object.values(folders).sort((a, b) => a.name.localeCompare(b.name))

  const startRename = (conversation: Conversation) => {
    setRenamingId(conversation.id)
    setRenameDraft(conversation.title)
    setMenuOpenId(null)
  }
  const commitRename = () => {
    if (renamingId && renameDraft.trim()) {
      renameConversation(renamingId, renameDraft.trim())
    }
    setRenamingId(null)
  }

  const handleAddFolder = () => {
    if (newFolderName.trim()) {
      createFolder(newFolderName.trim())
    }
    setNewFolderName('')
    setIsAddingFolder(false)
  }

  const renderConversationRow = (conversation: Conversation) => {
    const isRenaming = renamingId === conversation.id
    const isMenuOpen = menuOpenId === conversation.id

    if (isRenaming) {
      return (
        <div key={conversation.id} className="px-1 py-1">
          <input
            autoFocus
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setRenamingId(null)
            }}
            onBlur={commitRename}
            className="w-full rounded-lg border border-accent bg-surface px-2 py-1.5 text-sm text-ink"
          />
        </div>
      )
    }

    const titleNode = trimmedQuery ? (
      <HighlightedText text={conversation.title} query={trimmedQuery} />
    ) : (
      conversation.title
    )

    return (
      <div key={conversation.id} className="group relative flex items-center gap-1">
        {selectMode && (
          <input
            type="checkbox"
            checked={selectedIds.has(conversation.id)}
            onChange={() => toggleSelected(conversation.id)}
            aria-label={`Select ${conversation.title}`}
            className="ml-2 shrink-0"
          />
        )}
        <div className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={() => selectConversation(conversation.id)}
            className={`block w-full truncate rounded-lg px-3 py-2 text-left text-sm transition ${
              conversation.id === activeId
                ? 'bg-accent/15 text-ink'
                : 'text-ink-muted hover:bg-surface-raised hover:text-ink'
            }`}
          >
            {conversation.pinned ? '📌 ' : ''}
            {titleNode}
          </button>
          {trimmedQuery &&
            searchMatchIds.size > 0 &&
            !searchMatches.find((m) => m.conversationId === conversation.id)?.titleMatch && (
              <p className="truncate px-3 pb-1 text-xs text-ink-faint">
                {
                  searchMatches.find((m) => m.conversationId === conversation.id)
                    ?.messageSnippets[0]
                }
              </p>
            )}

          <button
            type="button"
            onClick={() => setMenuOpenId(isMenuOpen ? null : conversation.id)}
            aria-label={`More actions for ${conversation.title}`}
            className="absolute right-1 top-1 hidden rounded-md px-1.5 py-0.5 text-ink-faint hover:bg-surface hover:text-ink group-hover:block"
          >
            ⋯
          </button>

          {isMenuOpen && (
            <div className="absolute right-1 top-8 z-10 w-40 rounded-lg border border-border bg-surface-raised p-1 text-xs shadow-lg">
              <button
                type="button"
                onClick={() => startRename(conversation)}
                className="block w-full rounded px-2 py-1.5 text-left text-ink-muted hover:bg-surface hover:text-ink"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => {
                  togglePinned(conversation.id)
                  setMenuOpenId(null)
                }}
                className="block w-full rounded px-2 py-1.5 text-left text-ink-muted hover:bg-surface hover:text-ink"
              >
                {conversation.pinned ? 'Unpin' : 'Pin'}
              </button>
              {folderList.length > 0 && (
                <label className="block px-2 py-1.5 text-ink-muted">
                  Folder
                  <select
                    value={conversation.folderId ?? ''}
                    onChange={(e) => {
                      setConversationFolder(conversation.id, e.target.value || null)
                      setMenuOpenId(null)
                    }}
                    className="mt-0.5 w-full rounded border border-border bg-surface px-1 py-0.5 text-ink"
                  >
                    <option value="">Unfiled</option>
                    {folderList.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                onClick={() => {
                  toggleArchived(conversation.id)
                  setMenuOpenId(null)
                }}
                className="block w-full rounded px-2 py-1.5 text-left text-ink-muted hover:bg-surface hover:text-ink"
              >
                Archive
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteConversation(conversation.id)
                  setMenuOpenId(null)
                }}
                className="block w-full rounded px-2 py-1.5 text-left text-red-700 hover:bg-red-500/10 dark:text-red-400"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const searchResultConversations = searchMatches
    .map((m) => conversations[m.conversationId])
    .filter((c): c is Conversation => Boolean(c))

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-surface-sunken transition-transform md:static md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-sm font-semibold tracking-wide text-ink">Pawan AI Chatbot</span>
        </div>

        <div className="space-y-2 px-3">
          {projectList.length > 0 && (
            <select
              value={activeProjectId ?? ''}
              onChange={(e) => setActiveProject(e.target.value || null)}
              aria-label="Active project"
              className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-xs text-ink"
            >
              <option value="">All conversations</option>
              {projectList.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => createConversationInContext()}
            className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-left text-sm font-medium text-ink transition hover:border-accent/60"
          >
            + New chat
          </button>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
            className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint"
          />
          <div className="flex items-center gap-2">
            {!trimmedQuery && (
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as ConversationSortMode)}
                aria-label="Sort conversations"
                className="flex-1 rounded-lg border border-border bg-surface px-2 py-1 text-xs text-ink"
              >
                {Object.entries(SORT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => {
                setSelectMode((v) => !v)
                setSelectedIds(new Set())
              }}
              className="shrink-0 rounded-lg border border-border px-2 py-1 text-xs text-ink-muted hover:bg-surface hover:text-ink"
            >
              {selectMode ? 'Cancel' : 'Select'}
            </button>
          </div>
          {selectMode && selectedIds.size > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-ink-faint">{selectedIds.size} selected:</span>
              <button
                type="button"
                onClick={() => void handleExportSelected('zip')}
                className="rounded border border-border px-1.5 py-0.5 text-xs text-ink hover:bg-surface"
              >
                Export as ZIP
              </button>
              <button
                type="button"
                onClick={() => void handleExportSelected('markdown')}
                className="rounded border border-border px-1.5 py-0.5 text-xs text-ink hover:bg-surface"
              >
                Markdown
              </button>
              <button
                type="button"
                onClick={() => void handleExportSelected('json')}
                className="rounded border border-border px-1.5 py-0.5 text-xs text-ink hover:bg-surface"
              >
                JSON
              </button>
            </div>
          )}
        </div>

        <nav className="mt-3 flex-1 space-y-1 overflow-y-auto px-3 pb-3" aria-label="Conversations">
          {trimmedQuery ? (
            <>
              {searchResultConversations.length === 0 && (
                <p className="px-2 py-6 text-center text-xs text-ink-faint">No matches.</p>
              )}
              {searchResultConversations.map(renderConversationRow)}
            </>
          ) : (
            <>
              {active.length === 0 && (
                <p className="px-2 py-6 text-center text-xs text-ink-faint">
                  No conversations yet. Start one above.
                </p>
              )}

              {pinned.length > 0 && (
                <div>
                  <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                    Pinned
                  </p>
                  {pinned.map(renderConversationRow)}
                </div>
              )}

              {folderList.map((folder) => {
                const folderConversations = sortConversations(
                  active.filter((c) => c.folderId === folder.id && !c.pinned),
                  sortMode
                )
                if (folderConversations.length === 0) return null
                return (
                  <div key={folder.id}>
                    <p className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                      {folder.name}
                    </p>
                    {folderConversations.map(renderConversationRow)}
                  </div>
                )
              })}

              {unfiled.length > 0 && (
                <div>
                  {(pinned.length > 0 || folderList.length > 0) && (
                    <p className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                      Unfiled
                    </p>
                  )}
                  {unfiled.map(renderConversationRow)}
                </div>
              )}

              {isAddingFolder ? (
                <div className="flex gap-1 px-1 pt-2">
                  <input
                    autoFocus
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
                    placeholder="Folder name"
                    className="flex-1 rounded-lg border border-border bg-surface px-2 py-1 text-xs text-ink"
                  />
                  <button
                    type="button"
                    onClick={handleAddFolder}
                    className="rounded-lg border border-border px-2 py-1 text-xs text-ink hover:bg-surface"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingFolder(true)}
                  className="mt-2 w-full rounded-lg px-2 py-1.5 text-left text-xs text-ink-faint hover:bg-surface-raised hover:text-ink-muted"
                >
                  + New folder
                </button>
              )}

              {archived.length > 0 && (
                <div className="mt-2 border-t border-border pt-2">
                  <button
                    type="button"
                    onClick={() => setShowArchived((v) => !v)}
                    className="w-full px-2 pb-1 text-left text-[10px] font-medium uppercase tracking-wide text-ink-faint hover:text-ink-muted"
                  >
                    {showArchived ? '▾' : '▸'} Archived ({archived.length})
                  </button>
                  {showArchived &&
                    archived.map((conversation) => (
                      <div
                        key={conversation.id}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-ink-faint"
                      >
                        <span className="truncate">{conversation.title}</span>
                        <button
                          type="button"
                          onClick={() => toggleArchived(conversation.id)}
                          className="shrink-0 text-xs text-accent-hover hover:underline"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </>
          )}
        </nav>

        <div className="space-y-1 border-t border-border p-3">
          <button
            type="button"
            onClick={onOpenProjects}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink-muted transition hover:bg-surface-raised hover:text-ink"
          >
            🗂 Projects
          </button>
          <button
            type="button"
            onClick={onOpenPromptLibrary}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink-muted transition hover:bg-surface-raised hover:text-ink"
          >
            📚 Prompt Library
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink-muted transition hover:bg-surface-raised hover:text-ink"
          >
            ⚙ Settings
          </button>
        </div>
      </aside>
    </>
  )
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const segments = highlightMatches(text, query)
  return (
    <>
      {segments.map((segment, i) => (
        <span key={i} className={segment.match ? 'bg-accent/30 text-ink' : undefined}>
          {segment.text}
        </span>
      ))}
    </>
  )
}
