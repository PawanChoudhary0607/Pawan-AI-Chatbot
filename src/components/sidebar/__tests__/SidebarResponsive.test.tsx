import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { useConversationStore } from '@/state/conversationStore'
import { useSettingsStore } from '@/state/settingsStore'

describe('Sidebar — responsive mobile behavior', () => {
  beforeEach(() => {
    useConversationStore.setState({ conversations: {}, activeConversationId: null, folders: {} })
    useSettingsStore.setState({ uiPreferences: {} })
  })

  it('is off-screen (translate-x-full) when mobileOpen is false', () => {
    const { container } = render(
      <Sidebar
        mobileOpen={false}
        onCloseMobile={() => {}}
        onOpenSettings={() => {}}
        onOpenPromptLibrary={() => {}}
        onOpenProjects={() => {}}
      />
    )
    const aside = container.querySelector('aside')
    const classes = aside?.className.split(/\s+/) ?? []
    expect(classes).toContain('-translate-x-full')
    expect(classes).not.toContain('translate-x-0') // the un-prefixed (mobile) variant specifically
  })

  it('slides on-screen (translate-x-0) and shows a backdrop when mobileOpen is true', () => {
    const { container } = render(
      <Sidebar
        mobileOpen={true}
        onCloseMobile={() => {}}
        onOpenSettings={() => {}}
        onOpenPromptLibrary={() => {}}
        onOpenProjects={() => {}}
      />
    )
    const aside = container.querySelector('aside')
    expect(aside?.className).toContain('translate-x-0')
    // The backdrop (mobile-only click-to-close overlay) should be present.
    expect(container.querySelector('.bg-black\\/50')).toBeInTheDocument()
  })

  it('clicking the mobile backdrop calls onCloseMobile', async () => {
    const onCloseMobile = vi.fn()
    const { container } = render(
      <Sidebar
        mobileOpen={true}
        onCloseMobile={onCloseMobile}
        onOpenSettings={() => {}}
        onOpenPromptLibrary={() => {}}
        onOpenProjects={() => {}}
      />
    )
    const backdrop = container.querySelector('.bg-black\\/50') as HTMLElement
    await userEvent.click(backdrop)
    expect(onCloseMobile).toHaveBeenCalledTimes(1)
  })

  it('has no backdrop when mobileOpen is false', () => {
    const { container } = render(
      <Sidebar
        mobileOpen={false}
        onCloseMobile={() => {}}
        onOpenSettings={() => {}}
        onOpenPromptLibrary={() => {}}
        onOpenProjects={() => {}}
      />
    )
    expect(container.querySelector('.bg-black\\/50')).not.toBeInTheDocument()
  })
})
