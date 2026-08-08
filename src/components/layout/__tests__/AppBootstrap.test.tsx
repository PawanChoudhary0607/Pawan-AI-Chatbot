import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AppBootstrap } from '@/components/layout/AppBootstrap'
import { persistenceService } from '@/storage/persistenceService'
import { useConversationStore } from '@/state/conversationStore'
import { useSettingsStore } from '@/state/settingsStore'
import { usePromptStore } from '@/state/promptStore'
import { useProjectStore } from '@/state/projectStore'

/** Defers resolution until we explicitly call resolve() — lets us assert
 * on the "still loading" state before letting initialization finish. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('AppBootstrap — startup loading screen', () => {
  beforeEach(() => {
    useConversationStore.setState({ conversations: {}, activeConversationId: null, folders: {} })
    useSettingsStore.setState({ uiPreferences: {} })
    usePromptStore.setState({ prompts: [] })
    useProjectStore.setState({ projects: {}, activeProjectId: null })
  })

  it('shows the loading screen immediately, before persistenceService.init() resolves', async () => {
    const gate = deferred<void>()
    vi.spyOn(persistenceService, 'init').mockReturnValue(gate.promise)

    render(<AppBootstrap />)

    expect(screen.getByRole('status', { name: /loading pawan ai chatbot/i })).toBeInTheDocument()

    gate.resolve()
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    vi.restoreAllMocks()
  })

  it('the loading screen disappears and the app renders once init() resolves', async () => {
    const gate = deferred<void>()
    vi.spyOn(persistenceService, 'init').mockReturnValue(gate.promise)

    render(<AppBootstrap />)
    expect(screen.getByText(/loading your conversations/i)).toBeInTheDocument()

    gate.resolve()

    await waitFor(() =>
      expect(screen.queryByText(/loading your conversations/i)).not.toBeInTheDocument()
    )
    // The real app shell should now be mounted — the "+ New chat" button
    // is a stable, always-present part of it.
    expect(await screen.findByText('+ New chat')).toBeInTheDocument()
    vi.restoreAllMocks()
  })
})
