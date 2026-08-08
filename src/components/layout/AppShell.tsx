import { lazy, Suspense, useState } from 'react'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { ModalSkeleton } from '@/components/layout/ModalSkeleton'
import { useKeyboardShortcuts } from '@/shortcuts/useKeyboardShortcuts'
import { useCreateConversationInContext } from '@/hooks/useCreateConversationInContext'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

// Lazy-loaded: none of these are needed for the initial paint. Splitting
// them into their own chunks keeps the critical path (shell + first
// conversation) lighter; see the Milestone 8 bundle report.
const SettingsModal = lazy(() =>
  import('@/components/settings/SettingsModal').then((m) => ({ default: m.SettingsModal }))
)
const PromptLibraryModal = lazy(() =>
  import('@/components/prompts/PromptLibraryModal').then((m) => ({ default: m.PromptLibraryModal }))
)
const CommandPalette = lazy(() =>
  import('@/components/command/CommandPalette').then((m) => ({ default: m.CommandPalette }))
)
const ProjectsModal = lazy(() =>
  import('@/components/projects/ProjectsModal').then((m) => ({ default: m.ProjectsModal }))
)

export function AppShell() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [promptLibraryOpen, setPromptLibraryOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const createConversationInContext = useCreateConversationInContext()
  const isOnline = useOnlineStatus()

  useKeyboardShortcuts({
    'mod+k': () => setCommandPaletteOpen((open) => !open),
    'mod+n': () => createConversationInContext(),
  })

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-surface text-ink">
      {!isOnline && (
        <div
          role="status"
          className="shrink-0 bg-amber-500/15 px-4 py-1.5 text-center text-xs text-amber-800 dark:text-amber-400"
        >
          You're offline — messages won't send until your connection is back.
        </div>
      )}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar
          mobileOpen={sidebarOpen}
          onCloseMobile={() => setSidebarOpen(false)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenPromptLibrary={() => setPromptLibraryOpen(true)}
          onOpenProjects={() => setProjectsOpen(true)}
        />
        <ChatPanel onOpenSidebar={() => setSidebarOpen(true)} />
        <Suspense fallback={<ModalSkeleton />}>
          {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
          {promptLibraryOpen && <PromptLibraryModal onClose={() => setPromptLibraryOpen(false)} />}
          {commandPaletteOpen && <CommandPalette onClose={() => setCommandPaletteOpen(false)} />}
          {projectsOpen && <ProjectsModal onClose={() => setProjectsOpen(false)} />}
        </Suspense>
      </div>
    </div>
  )
}
