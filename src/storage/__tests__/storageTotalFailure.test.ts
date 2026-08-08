import { describe, expect, it, vi } from 'vitest'

/**
 * Kept in its own file for the same reason as indexedDbFallback.test.ts:
 * it must be the first test to touch the `dexie` package in this process so
 * deleting `globalThis.indexedDB` actually takes effect.
 */
describe('Total storage failure (no IndexedDB, no localStorage)', () => {
  it('never crashes the app — it just runs in-memory for the session', async () => {
    const originalIDB = globalThis.indexedDB
    const originalLocalStorage = window.localStorage

    // @ts-expect-error -- deliberately breaking the environment for this test
    delete globalThis.indexedDB
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('localStorage disabled for this test')
      },
    })

    vi.resetModules()
    const { useConversationStore } = await import('@/state/conversationStore')
    const { persistenceService } = await import('@/storage/persistenceService')

    await expect(persistenceService.init()).resolves.not.toThrow()
    // storage/index.ts falls all the way back to an in-memory no-op
    // provider if even localStorage is broken — persistenceService.storage
    // is therefore never null, it's just backed by nothing durable.
    expect((persistenceService as unknown as { storage: unknown }).storage).not.toBeNull()

    // The app should still be fully usable in-memory even though nothing
    // will survive a real refresh in this state.
    const id = useConversationStore.getState().createConversation('openrouter', 'test-model')
    expect(useConversationStore.getState().conversations[id]).toBeDefined()

    globalThis.indexedDB = originalIDB
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    })
  })
})
