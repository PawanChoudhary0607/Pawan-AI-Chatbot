import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { ProviderModelSelector } from '@/components/chat/ProviderModelSelector'
import { providerRegistry } from '@/providers/registry'
import { useSettingsStore } from '@/state/settingsStore'
import { useConversationStore } from '@/state/conversationStore'
import { DEFAULT_CAPABILITIES } from '@/providers/defaultCapabilities'
import type { ChatProvider } from '@/types/provider'

function makeFakeProvider(id: string, listModels: ChatProvider['listModels']): ChatProvider {
  return {
    meta: {
      id,
      name: `Fake (${id})`,
      isLocal: false,
      requiresKey: true,
      credentialFields: [{ key: 'apiKey', label: 'API key', type: 'apiKey' }],
      capabilities: DEFAULT_CAPABILITIES,
    },
    validateKey: async () => ({ valid: true }),
    listModels,
    sendMessage: async () => ({ content: '' }),
    async *streamMessage() {
      yield { type: 'done' as const }
    },
    estimateCost: () => ({ inputTokens: 0, outputTokens: 0, isEstimate: true }),
    estimateContext: () => ({ usedTokens: 0, isEstimate: true }),
    supportsCapability: () => false,
  }
}

describe('ProviderModelSelector', () => {
  beforeEach(() => {
    useConversationStore.setState({ conversations: {}, activeConversationId: null, folders: {} })
    useSettingsStore.setState({
      credentials: {},
      modelsByProvider: {},
      validation: {},
      defaultProviderId: null,
      defaultModel: null,
    })
  })

  it('does not fetch models when the provider requires a key and none is set', () => {
    const providerId = `fake-${crypto.randomUUID()}`
    const listModels = vi.fn().mockResolvedValue([])
    providerRegistry.register(makeFakeProvider(providerId, listModels))

    render(<ProviderModelSelector conversationId="c1" providerId={providerId} model="" />)

    expect(listModels).not.toHaveBeenCalled()
    expect(screen.getByText('Add an API key in Settings')).toBeInTheDocument()
  })

  it('fetches models once credentials are present', async () => {
    const providerId = `fake-${crypto.randomUUID()}`
    const listModels = vi.fn().mockResolvedValue([{ id: 'model-a', name: 'Model A' }])
    providerRegistry.register(makeFakeProvider(providerId, listModels))
    useSettingsStore.getState().setCredentials(providerId, { apiKey: 'sk-first' })

    render(<ProviderModelSelector conversationId="c1" providerId={providerId} model="" />)

    await waitFor(() => expect(listModels).toHaveBeenCalledTimes(1))
    expect(listModels).toHaveBeenCalledWith({ apiKey: 'sk-first' })
  })

  it('refetches with the corrected key after editing an already-present API key (regression: previously stayed stale)', async () => {
    const providerId = `fake-${crypto.randomUUID()}`
    const listModels = vi.fn().mockResolvedValue([{ id: 'model-a', name: 'Model A' }])
    providerRegistry.register(makeFakeProvider(providerId, listModels))
    useSettingsStore.getState().setCredentials(providerId, { apiKey: 'sk-typo' })

    const { rerender } = render(
      <ProviderModelSelector conversationId="c1" providerId={providerId} model="" />
    )
    await waitFor(() => expect(listModels).toHaveBeenCalledTimes(1))
    expect(listModels).toHaveBeenLastCalledWith({ apiKey: 'sk-typo' })

    // User corrects the key — same provider, same "has credentials" status,
    // only the key value itself changes.
    act(() => {
      useSettingsStore.getState().setCredentials(providerId, { apiKey: 'sk-corrected' })
    })
    rerender(<ProviderModelSelector conversationId="c1" providerId={providerId} model="" />)

    await waitFor(() => expect(listModels).toHaveBeenCalledTimes(2))
    expect(listModels).toHaveBeenLastCalledWith({ apiKey: 'sk-corrected' })
  })

  it('does not refetch on an unrelated re-render when the key is unchanged', async () => {
    const providerId = `fake-${crypto.randomUUID()}`
    const listModels = vi.fn().mockResolvedValue([{ id: 'model-a', name: 'Model A' }])
    providerRegistry.register(makeFakeProvider(providerId, listModels))
    useSettingsStore.getState().setCredentials(providerId, { apiKey: 'sk-stable' })

    const { rerender } = render(
      <ProviderModelSelector conversationId="c1" providerId={providerId} model="" />
    )
    await waitFor(() => expect(listModels).toHaveBeenCalledTimes(1))

    rerender(<ProviderModelSelector conversationId="c1" providerId={providerId} model="model-a" />)
    rerender(<ProviderModelSelector conversationId="c1" providerId={providerId} model="model-a" />)

    // Give any accidental async refetch a chance to happen before asserting it didn't.
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(listModels).toHaveBeenCalledTimes(1)
  })
})
