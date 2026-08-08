import { useCallback } from 'react'
import { useConversationStore } from '@/state/conversationStore'
import { useSettingsStore } from '@/state/settingsStore'
import { useProjectStore } from '@/state/projectStore'

export function useCreateConversationInContext(): () => string {
  const createConversation = useConversationStore((s) => s.createConversation)
  const defaultProviderId = useSettingsStore((s) => s.defaultProviderId)
  const defaultModel = useSettingsStore((s) => s.defaultModel)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const projects = useProjectStore((s) => s.projects)

  return useCallback(() => {
    const activeProject = activeProjectId ? projects[activeProjectId] : undefined
    const providerId = activeProject?.defaultProviderId ?? defaultProviderId ?? ''
    const model = activeProject?.defaultModel ?? defaultModel ?? ''
    return createConversation(providerId, model, {
      projectId: activeProjectId,
      systemPrompt: activeProject?.instructions,
    })
  }, [createConversation, defaultProviderId, defaultModel, activeProjectId, projects])
}
