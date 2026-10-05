import { ChevronRight, Dot } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface DissectionNode {
  label: string
  tree?: DissectionNode[]
  length: number
  data_source_idx: number
  start: number
}

interface DissectionSelection {
  id: string
  idx: number
  start: number
  length: number
}

export const NO_SELECTION: DissectionSelection = { id: '', idx: 0, start: 0, length: 0 }

interface DissectionSubTreeProps {
  id: string
  node: DissectionNode
  select: (selection: DissectionSelection) => void
  selected: string
}

function DissectionSubTree({ id, node, select, selected }: DissectionSubTreeProps) {
  const [open, setOpen] = useState(false)
  const hasChildren = !!node.tree?.length
  const containsSelection = selected.startsWith(`${id}-`)

  // Reveal the field picked from the hex dump
  useEffect(() => {
    if (containsSelection) setOpen(true)
  }, [containsSelection])

  const setExpanded = (next: boolean) => {
    if (!next && containsSelection) select(NO_SELECTION)
    setOpen(next)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!hasChildren) return
    if (e.key === 'ArrowRight' && !open) setExpanded(true)
    else if (e.key === 'ArrowLeft' && open) setExpanded(false)
    else return
    e.preventDefault()
  }

  return (
    <>
      <div
        className={cn(
          'flex w-full items-center rounded-sm',
          id === selected ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
        )}
      >
        {hasChildren ? (
          <ChevronRight
            aria-hidden='true'
            onClick={() => setExpanded(!open)}
            className={cn('size-4 shrink-0 cursor-pointer opacity-60 transition-transform', open && 'rotate-90')}
          />
        ) : (
          <Dot aria-hidden='true' className='size-4 shrink-0 opacity-40' />
        )}
        <button
          type='button'
          aria-expanded={hasChildren ? open : undefined}
          onClick={() => {
            if (node.length > 0) select({ id, idx: node.data_source_idx, start: node.start, length: node.length })
            else if (hasChildren) setExpanded(!open)
          }}
          onDoubleClick={() => hasChildren && setExpanded(!open)}
          onKeyDown={onKeyDown}
          className='ml-1 w-full cursor-default py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring'
        >
          {node.label}
        </button>
      </div>
      {hasChildren && open && <DissectionTree id={id} tree={node.tree!} select={select} selected={selected} />}
    </>
  )
}

interface DissectionTreeProps {
  id: string
  tree: DissectionNode[]
  select?: (selection: DissectionSelection) => void
  root?: boolean
  selected?: string
}

function DissectionTree({ id, tree, select = () => {}, root = false, selected = '' }: DissectionTreeProps) {
  return (
    <ul className={cn(!root && 'ml-2 border-l pl-2')}>
      {tree.map((n, i) => (
        <li key={`${id}-${i}`}>
          <DissectionSubTree id={`${id}-${i}`} node={n} select={select} selected={selected} />
        </li>
      ))}
    </ul>
  )
}

export default DissectionTree
export type { DissectionNode, DissectionSelection }
