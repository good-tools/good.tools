import { useState, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeft, Search } from 'lucide-react'
import { filteredTools } from '@/config/tools.config'
import { categories, type CategoryName, CATEGORIES } from '@/lib/categories'
import { useLayoutStore } from '@/stores/useLayoutStore'
import { cn } from '@/lib/utils'
import type { Tool } from '@/types'

interface CategorySectionProps {
  category: CategoryName
  tools: Tool[]
  isCollapsed: boolean
}

function CategorySection({ category, tools, isCollapsed }: CategorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const location = useLocation()
  const categoryDef = categories.find((c) => c.name === category)
  const CategoryIcon = categoryDef?.icon

  if (tools.length === 0) return null

  if (isCollapsed) {
    // In collapsed mode, just show the tools as icons
    return (
      <div className='py-1'>
        {tools.map((tool) => {
          const isActive = location.pathname === tool.href
          const ToolIcon = tool.icon
          return (
            <Link
              key={tool.href}
              to={tool.href}
              title={tool.title}
              className={cn(
                'flex items-center justify-center h-9 w-9 mx-auto my-0.5 transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
              )}
            >
              <ToolIcon className='h-4 w-4' />
            </Link>
          )
        })}
      </div>
    )
  }

  return (
    <div className='py-1'>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className='flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors uppercase tracking-wider'
      >
        {isExpanded ? <ChevronDown className='h-3 w-3' /> : <ChevronRight className='h-3 w-3' />}
        {CategoryIcon && <CategoryIcon className='h-3 w-3' />}
        <span>{category}</span>
        <span className='ml-auto text-sidebar-foreground/40'>{tools.length}</span>
      </button>

      {isExpanded && (
        <div className='mt-0.5'>
          {tools.map((tool) => {
            const isActive = location.pathname === tool.href
            const ToolIcon = tool.icon
            return (
              <Link
                key={tool.href}
                to={tool.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-sm transition-colors border-l-2 ml-3',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-primary'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground border-transparent',
                )}
              >
                <ToolIcon className='h-4 w-4 flex-shrink-0' />
                <span className='truncate'>{tool.title}</span>
                {tool.online && (
                  <span className='ml-auto text-[10px] px-1 py-0.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded'>
                    online
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useLayoutStore()
  const [searchQuery, setSearchQuery] = useState('')
  const location = useLocation()

  // Group tools by their primary category
  const toolsByCategory = useMemo(() => {
    const groups: Record<CategoryName, Tool[]> = {
      [CATEGORIES.DEVELOPMENT]: [],
      [CATEGORIES.ENCODING]: [],
      [CATEGORIES.SECURITY]: [],
      [CATEGORIES.NETWORK]: [],
      [CATEGORIES['3D']]: [],
    }

    const toolsToShow = searchQuery
      ? filteredTools.filter(
          (tool) =>
            tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            tool.searchTags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())),
        )
      : filteredTools

    toolsToShow.forEach((tool) => {
      const primaryCategory = tool.categories[0]
      if (primaryCategory && groups[primaryCategory]) {
        groups[primaryCategory].push(tool)
      }
    })

    return groups
  }, [searchQuery])

  const isHomePage = location.pathname === '/'

  return (
    <aside
      className={cn(
        'h-full bg-sidebar-background border-r border-sidebar-border flex flex-col transition-all duration-200',
        sidebarCollapsed ? 'w-12' : 'w-60',
      )}
    >
      {/* Sidebar Header */}
      <div className='flex items-center justify-between p-2 border-b border-sidebar-border'>
        {!sidebarCollapsed && <span className='text-xs font-medium text-sidebar-foreground/60 px-1'>TOOLS</span>}
        <button
          onClick={toggleSidebar}
          className='p-1.5 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors ml-auto'
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeft className='h-4 w-4' /> : <PanelLeftClose className='h-4 w-4' />}
        </button>
      </div>

      {/* Search (only when expanded) */}
      {!sidebarCollapsed && (
        <div className='p-2 border-b border-sidebar-border'>
          <div className='relative'>
            <Search className='absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sidebar-foreground/40' />
            <input
              type='text'
              placeholder='Filter tools...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='w-full pl-7 pr-2 py-1.5 text-sm bg-transparent border border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus:outline-none focus:border-sidebar-ring'
            />
          </div>
        </div>
      )}

      {/* Home link */}
      <div className='border-b border-sidebar-border'>
        <Link
          to='/'
          className={cn(
            'flex items-center gap-2 px-3 py-2 text-sm transition-colors',
            sidebarCollapsed && 'justify-center px-0',
            isHomePage
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
          )}
        >
          <svg className='h-4 w-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
            <path d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' />
            <polyline points='9 22 9 12 15 12 15 22' />
          </svg>
          {!sidebarCollapsed && <span>Home</span>}
        </Link>
      </div>

      {/* Tool Categories */}
      <div className='flex-1 overflow-y-auto'>
        {Object.entries(toolsByCategory).map(([category, categoryTools]) => (
          <CategorySection
            key={category}
            category={category as CategoryName}
            tools={categoryTools}
            isCollapsed={sidebarCollapsed}
          />
        ))}
      </div>

      {/* Footer */}
      {!sidebarCollapsed && (
        <div className='p-2 border-t border-sidebar-border'>
          <p className='text-[10px] text-sidebar-foreground/40 text-center'>{filteredTools.length} tools available</p>
        </div>
      )}
    </aside>
  )
}
