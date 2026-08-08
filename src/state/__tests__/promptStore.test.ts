import { beforeEach, describe, expect, it } from 'vitest'
import { usePromptStore } from '@/state/promptStore'

describe('usePromptStore', () => {
  beforeEach(() => {
    usePromptStore.setState({ prompts: [] })
  })

  it('creates a prompt with sensible defaults', () => {
    const id = usePromptStore
      .getState()
      .createPrompt('Summarize', 'Summarize this: {text}', 'Writing')
    const prompt = usePromptStore.getState().prompts.find((p) => p.id === id)
    expect(prompt).toMatchObject({
      title: 'Summarize',
      content: 'Summarize this: {text}',
      category: 'Writing',
      favorite: false,
    })
  })

  it('omits category when not provided', () => {
    const id = usePromptStore.getState().createPrompt('Title', 'Content')
    const prompt = usePromptStore.getState().prompts.find((p) => p.id === id)
    expect(prompt?.category).toBeUndefined()
  })

  it('updates a prompt in place', () => {
    const id = usePromptStore.getState().createPrompt('Old title', 'Old content')
    usePromptStore.getState().updatePrompt(id, { title: 'New title' })
    const prompt = usePromptStore.getState().prompts.find((p) => p.id === id)
    expect(prompt?.title).toBe('New title')
    expect(prompt?.content).toBe('Old content') // untouched
  })

  it('deletes a prompt', () => {
    const id = usePromptStore.getState().createPrompt('Title', 'Content')
    usePromptStore.getState().deletePrompt(id)
    expect(usePromptStore.getState().prompts.find((p) => p.id === id)).toBeUndefined()
  })

  it('toggles favorite on and back off', () => {
    const id = usePromptStore.getState().createPrompt('Title', 'Content')
    usePromptStore.getState().toggleFavorite(id)
    expect(usePromptStore.getState().prompts.find((p) => p.id === id)?.favorite).toBe(true)
    usePromptStore.getState().toggleFavorite(id)
    expect(usePromptStore.getState().prompts.find((p) => p.id === id)?.favorite).toBe(false)
  })

  it('hydrate replaces state without emitting further mutations', () => {
    const now = Date.now()
    usePromptStore.getState().hydrate([
      {
        id: 'p1',
        title: 'Restored',
        content: 'x',
        favorite: true,
        createdAt: now,
        updatedAt: now,
      },
    ])
    expect(usePromptStore.getState().prompts).toHaveLength(1)
    expect(usePromptStore.getState().prompts[0].title).toBe('Restored')
  })
})
