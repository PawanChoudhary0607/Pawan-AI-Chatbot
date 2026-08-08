import { providerRegistry } from '@/providers/registry'
import { openRouterProvider } from '@/providers/openrouter'
import { geminiProvider } from '@/providers/gemini'
import { ollamaProvider } from '@/providers/ollama'
import { anthropicProvider } from '@/providers/anthropic'

let bootstrapped = false

/**
 * Registers all built-in providers. Called once at app startup, before
 * anything reads providerRegistry.list().
 */
export function bootstrapProviders(): void {
  if (bootstrapped) return
  bootstrapped = true

  for (const provider of [openRouterProvider, geminiProvider, ollamaProvider, anthropicProvider]) {
    if (!providerRegistry.has(provider.meta.id)) {
      providerRegistry.register(provider)
    }
  }
}
