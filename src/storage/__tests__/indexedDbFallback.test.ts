import { beforeEach, describe, expect, it, vi } from 'vitest'

function wait(ms = 20): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * This scenario needs to be the FIRST thing to import the `dexie` package
 * in this test run: Vite's dependency pre-bundler caches `dexie` (and its
 * captured `indexedDB` reference) independently of `vi.resetModules()`, so
 * if another test in the same file already imported Dexie successfully
 * before this one deletes `globalThis.indexedDB`, Dexie keeps working off
 * its earlier-captured reference and the fallback never triggers. Keeping
 * this as a standalone file sidesteps that entirely — it's a Vitest/Vite
 * caching quirk, not app behavior, and doesn't happen in a real browser.
 */
describe('IndexedDB unavailable -> automatic localStorage fallback', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('falls back to localStorage and the app remains fully usable', async () => {
    const originalIDB = globalThis.indexedDB
    // @ts-expect-error -- deliberately simulating an environment without IndexedDB
    delete globalThis.indexedDB

    vi.resetModules()
    const { useConversationStore } = await import('@/state/conversationStore')
    const { persistenceService } = await import('@/storage/persistenceService')

    await persistenceService.init()
    expect(
      (persistenceService as unknown as { storage: { backend: string } }).storage.backend
    ).toBe('localstorage')

    const id = useConversationStore.getState().createConversation('ollama', 'llama3')
    useConversationStore.getState().appendMessage(id, {
      id: 'm1',
      role: 'user',
      content: 'Works without IndexedDB',
      status: 'complete',
      createdAt: Date.now(),
    })
    // @ts-expect-error -- reaching into a private field is fine in a test.
    persistenceService.debouncer.flushAll()
    await wait()

    // Verify it actually landed in localStorage, not just in memory.
    const raw = window.localStorage.getItem(`pac:conversation:${id}:meta`)
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!).providerId).toBe('ollama')

    globalThis.indexedDB = originalIDB
  })
})
