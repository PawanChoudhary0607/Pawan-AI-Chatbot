import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectsModal } from '@/components/projects/ProjectsModal'
import { useProjectStore } from '@/state/projectStore'
import { usePromptStore } from '@/state/promptStore'

describe('ProjectsModal', () => {
  beforeEach(() => {
    useProjectStore.setState({ projects: {}, activeProjectId: null })
    usePromptStore.setState({ prompts: [] })
  })

  it('creates a new project', async () => {
    render(<ProjectsModal onClose={() => {}} />)

    await userEvent.type(screen.getByPlaceholderText('New project'), 'Research')
    await userEvent.click(screen.getByText('+ Add'))

    expect(Object.values(useProjectStore.getState().projects).map((p) => p.name)).toContain(
      'Research'
    )
  })

  it('shows a helper message when nothing is selected', () => {
    render(<ProjectsModal onClose={() => {}} />)
    expect(screen.getByText(/select or create a project/i)).toBeInTheDocument()
  })

  it('editing the selected project updates its name, description, and instructions', async () => {
    const id = useProjectStore.getState().createProject('Research')
    render(<ProjectsModal onClose={() => {}} />)

    await userEvent.click(screen.getByText('Research'))
    const nameInput = screen.getByDisplayValue('Research')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Deep Research')

    expect(useProjectStore.getState().projects[id].name).toBe('Deep Research')
  })

  it('adds and removes a prompt preset', async () => {
    const promptId = usePromptStore.getState().createPrompt('Outline', 'Write an outline')
    const projectId = useProjectStore.getState().createProject('Research')

    render(<ProjectsModal onClose={() => {}} />)
    await userEvent.click(screen.getByText('Research'))

    const presetSelect = screen.getByText('+ Add preset prompt…').closest('select')!
    await userEvent.selectOptions(presetSelect, promptId)

    expect(useProjectStore.getState().projects[projectId].promptIds).toContain(promptId)

    await userEvent.click(screen.getByLabelText('Remove preset Outline'))
    expect(useProjectStore.getState().projects[projectId].promptIds).not.toContain(promptId)
  })

  it('deletes the selected project', async () => {
    const id = useProjectStore.getState().createProject('Temp Project')
    render(<ProjectsModal onClose={() => {}} />)

    await userEvent.click(screen.getByText('Temp Project'))
    await userEvent.click(screen.getByText('Delete project'))

    expect(useProjectStore.getState().projects[id]).toBeUndefined()
  })

  it('lists multiple projects alphabetically', () => {
    useProjectStore.getState().createProject('Zebra')
    useProjectStore.getState().createProject('Alpha')
    render(<ProjectsModal onClose={() => {}} />)

    const buttons = screen.getAllByRole('button').map((b) => b.textContent)
    const alphaIndex = buttons.indexOf('Alpha')
    const zebraIndex = buttons.indexOf('Zebra')
    expect(alphaIndex).toBeLessThan(zebraIndex)
  })
})
