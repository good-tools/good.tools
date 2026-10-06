import type { LucideIcon } from 'lucide-react'
import type { ComponentType, LazyExoticComponent } from 'react'

export const CATEGORIES = {
  DEVELOPMENT: 'Development',
  ENCODING: 'Encoding',
  TEXT: 'Text',
  SECURITY: 'Security',
  NETWORK: 'Network',
  '3D': '3D & CAD',
  IMAGE: 'Image',
  PDF: 'PDF',
  MEDIA: 'Media',
} as const

export type CategoryName = (typeof CATEGORIES)[keyof typeof CATEGORIES]

export interface Dependency {
  name: string
  url?: string
}

export interface Tool {
  title: string
  /** URL path, e.g. `/base64`. Must be unique. */
  path: string
  description: string
  icon: LucideIcon
  /** First category is the primary one (used for grouping) */
  categories: [CategoryName, ...CategoryName[]]
  /** Extra search keywords */
  searchTags: string[]
  component: LazyExoticComponent<ComponentType>
  /** Sends data to a remote API (hidden when DISABLE_ONLINE_TOOLS is set) */
  online: boolean
  dependencies?: Dependency[]
  /** Shown before the tool loads; the user must click through */
  notice?: string
}
