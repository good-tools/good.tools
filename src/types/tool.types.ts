import { ReactElement, LazyExoticComponent, ComponentType } from 'react'

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
  title: string
  href: string
  tags: string[]
  component: LazyExoticComponent<ComponentType<unknown>>
  description: string
  online: boolean
  dependencies?: Dependency[]
  warning?: () => ReactElement
  tag?: string
}

/**
 * Tool category
 */
export interface ToolCategory {
  name: string
  keywords: string[]
  icon: ComponentType<{ className?: string }>
}
