import { Layers, Code, Binary, Shield, Globe, Box, Image, type LucideIcon } from 'lucide-react'
import { CATEGORIES, type CategoryName, type Tool, type ToolCategory } from '@/types/tool.types'

// Re-export for convenience
export { CATEGORIES, type CategoryName } from '@/types/tool.types'

/**
 * Category definitions with icons
 */
export const categories: ToolCategory[] = [
  { name: 'All', icon: Layers },
  { name: CATEGORIES.DEVELOPMENT, icon: Code },
  { name: CATEGORIES.ENCODING, icon: Binary },
  { name: CATEGORIES.SECURITY, icon: Shield },
  { name: CATEGORIES.NETWORK, icon: Globe },
  { name: CATEGORIES['3D'], icon: Box },
  { name: CATEGORIES.IMAGE, icon: Image },
]

/**
 * Get all category names (excluding 'All')
 */
export function getCategoryNames(): CategoryName[] {
  return Object.values(CATEGORIES)
}

/**
 * Filter tools by category
 * @param tools - Array of tools
 * @param category - Category to filter by (or 'All' for no filter)
 * @returns Filtered tools array
 */
export function getToolsByCategory(tools: Tool[], category: CategoryName | 'All'): Tool[] {
  if (category === 'All') {
    return tools
  }
  return tools.filter((tool) => tool.categories.includes(category))
}

/**
 * Get the primary category for a tool (first in the list)
 * Useful for display purposes when only one category can be shown
 * @param tool - The tool
 * @returns The primary category name
 */
export function getPrimaryCategory(tool: Tool): CategoryName {
  return tool.categories[0] ?? CATEGORIES.DEVELOPMENT
}

/**
 * Get the icon component for a category
 * @param category - Category name
 * @returns Lucide icon component
 */
export function getCategoryIcon(category: CategoryName | 'All'): LucideIcon {
  const categoryObj = categories.find((cat) => cat.name === category)
  return categoryObj?.icon ?? Layers
}

/**
 * Search tools by query string
 * Matches against title, description, and searchTags
 * @param tools - Array of tools
 * @param query - Search query
 * @returns Filtered tools array
 */
export function searchTools(tools: Tool[], query: string): Tool[] {
  if (!query.trim()) {
    return tools
  }

  const lowerQuery = query.toLowerCase()

  return tools.filter((tool) => {
    // Match title
    if (tool.title.toLowerCase().includes(lowerQuery)) {
      return true
    }

    // Match description
    if (tool.description.toLowerCase().includes(lowerQuery)) {
      return true
    }

    // Match search tags
    if (tool.searchTags.some((tag) => tag.toLowerCase().includes(lowerQuery))) {
      return true
    }

    return false
  })
}
