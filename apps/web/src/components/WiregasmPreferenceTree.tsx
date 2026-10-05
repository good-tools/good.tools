import { ChevronRight, Dot } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface ModuleNode {
  name: string
  title: string
  description: string
  use_gui: boolean
  submodules: ModuleNode[]
}

interface TreeProps {
  nodes: ModuleNode[]
  select: (node: ModuleNode) => void
  selected: ModuleNode | null
  /** Expand every branch (e.g. while filtering) */
  expandAll: boolean
}

function TreeNode({ node, select, selected, expandAll }: Omit<TreeProps, 'nodes'> & { node: ModuleNode }) {
  const [open, setOpen] = useState(false)
  const hasChildren = node.submodules.length > 0
  const expanded = hasChildren && (open || expandAll)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!hasChildren || expandAll) return
    if (e.key === 'ArrowRight' && !open) setOpen(true)
    else if (e.key === 'ArrowLeft' && open) setOpen(false)
    else return
    e.preventDefault()
  }

  return (
    <li>
      <div className='flex items-center'>
        {hasChildren ? (
          <ChevronRight
            aria-hidden='true'
            onClick={() => setOpen(!open)}
            className={cn('size-4 shrink-0 cursor-pointer opacity-60 transition-transform', expanded && 'rotate-90')}
          />
        ) : (
          <Dot aria-hidden='true' className='size-4 shrink-0 opacity-40' />
        )}
        <button
          type='button'
          aria-expanded={hasChildren ? expanded : undefined}
          aria-current={selected?.name === node.name || undefined}
          onClick={() => select(node)}
          onDoubleClick={() => hasChildren && setOpen(!open)}
          onKeyDown={onKeyDown}
          className={cn(
            'ml-1 w-full truncate rounded-sm px-1 py-0.5 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
            selected?.name === node.name && 'bg-accent font-medium text-accent-foreground',
          )}
        >
          {node.title}
        </button>
      </div>
      {expanded && <Tree nodes={node.submodules} select={select} selected={selected} expandAll={expandAll} nested />}
    </li>
  )
}

function Tree({ nodes, nested = false, ...props }: TreeProps & { nested?: boolean }) {
  return (
    <ul className={cn('text-sm', nested && 'ml-2 border-l pl-2')}>
      {nodes
        .filter((n) => n.use_gui)
        .map((n) => (
          <TreeNode key={n.name} node={n} {...props} />
        ))}
    </ul>
  )
}

export default Tree
export type { ModuleNode }
