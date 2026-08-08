import type { ChatProvider } from '@/types/provider'

/**
 * The provider registry is the ONLY place the app knows which providers
 * exist. UI components (model pickers, settings forms, capability gates)
 * read from this registry generically — never by importing a specific
 * adapter or checking `provider.id === '...'` for behavior decisions.
 *
 * Milestone 3 will register the OpenAI-compatible factory + OpenRouter.
 * Milestone 4 adds Gemini, Anthropic, and Ollama. This file intentionally
 * ships empty so the registration mechanism itself can be reviewed/tested
 * before any adapter logic exists.
 */
class ProviderRegistry {
  private providers: Map<string, ChatProvider> = new Map()

  register(provider: ChatProvider): void {
    if (this.providers.has(provider.meta.id)) {
      throw new Error(`Provider "${provider.meta.id}" is already registered.`)
    }
    this.providers.set(provider.meta.id, provider)
  }

  get(id: string): ChatProvider | undefined {
    return this.providers.get(id)
  }

  list(): ChatProvider[] {
    return Array.from(this.providers.values())
  }

  has(id: string): boolean {
    return this.providers.has(id)
  }
}

export const providerRegistry = new ProviderRegistry()
