import { textMatches } from '@/search/highlight'
import type { Project } from '@/types/project'

export function searchProjects(projects: Project[], query: string): Project[] {
  const trimmed = query.trim()
  if (!trimmed) return []
  return projects.filter(
    (project) =>
      textMatches(project.name, trimmed) ||
      (project.description ? textMatches(project.description, trimmed) : false)
  )
}
