import { Layers, Code, Binary, Shield, KeyRound, type LucideIcon } from 'lucide-react'
import type { Tool, ToolCategory } from '@/types'

/**
 * Category definitions with icons
 */
export const categories: ToolCategory[] = [
  { name: 'All', keywords: [], icon: Layers },
  {
    name: 'Development',
    keywords: ['diff', 'json', 'xml', 'formatter', 'docker', 'packet', 'dissector'],
    icon: Code,
  },
  {
    name: 'Encoding',
    keywords: ['base64', 'url', 'encoder', 'decoder', 'protobuf'],
    icon: Binary,
  },
  {
    name: 'Security',
    keywords: ['certificate', 'ssl', 'hash', 'java', 'deserializer', 'security'],
    icon: Shield,
  },
  {
    name: 'General',
    keywords: ['whats', 'my', 'ip', 'whois', 'dns', 'location'],
    icon: KeyRound,
  },
]

/**
 * Legacy CATEGORIES object for backward compatibility
 */
export const CATEGORIES = {
  ALL: 'All',
  DEVELOPMENT: 'Development',
  ENCODING: 'Encoding',
  SECURITY: 'Security',
  GENERAL: 'General',
} as const

export type CategoryName = (typeof CATEGORIES)[keyof typeof CATEGORIES]

/**
 * Category keywords mapping
 */
const categoryKeywords: Record<CategoryName, string[]> = {
  [CATEGORIES.ALL]: [],
  [CATEGORIES.DEVELOPMENT]: ['diff', 'json', 'xml', 'formatter', 'docker', 'packet', 'dissector'],
  [CATEGORIES.ENCODING]: ['base64', 'url', 'encoder', 'decoder', 'protobuf'],
  [CATEGORIES.SECURITY]: ['certificate', 'ssl', 'hash', 'java', 'deserializer', 'security'],
  [CATEGORIES.GENERAL]: ['whats', 'my', 'ip', 'whois', 'dns', 'location'],
}

/**
 * Get the category for a tool based on its tags
 * @param tool - The tool to categorize
 * @returns The category name
 */
export function getToolCategory(tool: Tool): CategoryName {
  const tags = tool.tags || []

  // Check each category for matching keywords
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (category === CATEGORIES.ALL) continue
    if (tags.some((tag) => keywords.some((keyword) => tag.toLowerCase().includes(keyword)))) {
      return category as CategoryName
    }
  }

  // Default to General if no match
  return CATEGORIES.GENERAL
}

/**
 * Filter tools by category
 * @param tools - Array of tools
 * @param category - Category to filter by
 * @returns Filtered tools array
 */
export function getToolsByCategory(tools: Tool[], category: CategoryName): Tool[] {
  if (category === CATEGORIES.ALL) {
    return tools
  }
  return tools.filter((tool) => getToolCategory(tool) === category)
}

/**
 * Icon name mapping for tools based on tags
 */
const tagIconMapping: Record<string, string> = {
  base64: 'FileText',
  json: 'Braces',
  xml: 'Code2',
  url: 'Link',
  diff: 'GitCompare',
  certificate: 'FileKey',
  protobuf: 'Package',
  java: 'Coffee',
  docker: 'Container',
  whois: 'Search',
  dns: 'Globe',
  hash: 'Hash',
  packet: 'Radio',
  wireshark: 'Radio',
  ip: 'MapPin',
  location: 'MapPin',
}

/**
 * Get the Lucide icon name for a tool based on its tags
 * @param tool - The tool to get icon for
 * @returns Lucide icon name
 */
export function getToolIcon(tool: Tool): string {
  const tags = tool.tags || []

  // Check tags for specific icon mappings
  for (const tag of tags) {
    const icon = tagIconMapping[tag]
    if (icon) return icon
  }

  // Default icon
  return 'Wrench'
}

/**
 * Get the icon component for a category
 * @param category - Category name
 * @returns Lucide icon component
 */
export function getCategoryIcon(category: string): LucideIcon {
  const categoryObj = categories.find((cat) => cat.name === category)
  return (categoryObj?.icon || Layers) as LucideIcon
}
