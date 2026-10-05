import { Binary, Box, Code, FileText, Globe, Image, Layers, Shield } from 'lucide-react'
import { CATEGORIES, type CategoryName, type Tool, type ToolCategory } from '@/types/tool.types'

export { CATEGORIES, type CategoryName } from '@/types/tool.types'

export const categories: ToolCategory[] = [
  { name: 'All', icon: Layers },
  { name: CATEGORIES.DEVELOPMENT, icon: Code },
  { name: CATEGORIES.ENCODING, icon: Binary },
  { name: CATEGORIES.SECURITY, icon: Shield },
  { name: CATEGORIES.NETWORK, icon: Globe },
  { name: CATEGORIES['3D'], icon: Box },
  { name: CATEGORIES.IMAGE, icon: Image },
  { name: CATEGORIES.PDF, icon: FileText },
]

export function getToolsByCategory(tools: Tool[], category: CategoryName | 'All'): Tool[] {
  return category === 'All' ? tools : tools.filter((tool) => tool.categories.includes(category))
}

/**
 * Case-insensitive match on title, description, tags and categories; every word in the query must match.
 * Results are ranked: title prefix > title match > tag match > description-only match.
 */
export function searchTools(tools: Tool[], query: string): Tool[] {
  const q = query.trim().toLowerCase()
  const words = q.split(/\s+/).filter(Boolean)
  if (words.length === 0) return tools
  const score = (tool: Tool) => {
    const title = tool.title.toLowerCase()
    if (title.startsWith(q)) return 0
    if (words.every((w) => title.includes(w))) return 1
    if (words.some((w) => tool.searchTags.some((t) => t.startsWith(w)))) return 2
    return 3
  }
  return tools
    .filter((tool) => {
      const haystack = [tool.title, tool.description, ...tool.searchTags, ...tool.categories].join(' ').toLowerCase()
      return words.every((w) => haystack.includes(w))
    })
    .map((tool) => ({ tool, score: score(tool) }))
    .sort((a, b) => a.score - b.score)
    .map(({ tool }) => tool)
}

/** Groups tools by their primary category, in category order, omitting empty groups. */
export function groupByCategory(tools: Tool[]): [CategoryName, Tool[]][] {
  return Object.values(CATEGORIES)
    .map((name): [CategoryName, Tool[]] => [name, tools.filter((t) => t.categories[0] === name)])
    .filter(([, list]) => list.length > 0)
}
