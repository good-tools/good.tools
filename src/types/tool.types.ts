import { ReactElement, LazyExoticComponent, ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'

/**
 * Category names
 */
export const CATEGORIES = {
  DEVELOPMENT: 'Development',
  ENCODING: 'Encoding',
  SECURITY: 'Security',
  NETWORK: 'Network',
} as const

export type CategoryName = (typeof CATEGORIES)[keyof typeof CATEGORIES]

/**
 * Dependency information for a tool
 */
export interface Dependency {
  name: string
  url?: string
}

/**
 * Tool configuration
 */
export interface Tool {
  /** Display title */
  title: string
  /** Route path */
  href: string
  /** Tool description */
  description: string
  /** Lucide icon component for this tool */
  icon: LucideIcon
  /** Categories this tool belongs to (supports multiple) */
  categories: CategoryName[]
  /** Tags used for search (not for categorization) */
  searchTags: string[]
  /** Lazy-loaded component */
  component: LazyExoticComponent<ComponentType<unknown>>
  /** Whether tool requires online API */
  online: boolean
  /** Optional dependencies to display */
  dependencies?: Dependency[]
  /** Optional warning component */
  warning?: () => ReactElement
}

/**
 * Tool category definition
 */
export interface ToolCategory {
  name: CategoryName | 'All'
  icon: LucideIcon
}
