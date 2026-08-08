import type { AppEventMap, AppEventName } from '@/types/events'

type Listener<K extends AppEventName> = (payload: AppEventMap[K]) => void

/**
 * Minimal typed event bus.
 *
 * Purpose: let features (persistence, sidebar, future notifications/plugins)
 * react to application lifecycle events without modules importing each
 * other directly. The chat send/stream pipeline, for example, only ever
 * emits events here — it never calls into UI components directly.
 */
class EventBus {
  private listeners: Map<AppEventName, Set<Listener<AppEventName>>> = new Map()

  on<K extends AppEventName>(event: K, listener: Listener<K>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener as Listener<AppEventName>)
    return () => this.off(event, listener)
  }

  off<K extends AppEventName>(event: K, listener: Listener<K>): void {
    this.listeners.get(event)?.delete(listener as Listener<AppEventName>)
  }

  emit<K extends AppEventName>(event: K, payload: AppEventMap[K]): void {
    this.listeners.get(event)?.forEach((listener) => {
      try {
        listener(payload)
      } catch (err) {
        // A single bad listener should never break the emitting code path.
        // eslint-disable-next-line no-console
        console.error(`[eventBus] listener for "${event}" threw`, err)
      }
    })
  }
}

export const eventBus = new EventBus()
