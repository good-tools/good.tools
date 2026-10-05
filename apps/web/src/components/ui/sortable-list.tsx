import { ArrowDown, ArrowUp, GripVertical, X } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Moves `list[from]` to index `to`. */
export function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}

/** Reorderable rows: drag the handle, or use the arrow buttons (keyboard). */
export function SortableList<T extends { id: string; name: string }>({
  items,
  onChange,
  children,
  actions,
}: {
  items: T[]
  onChange: (items: T[]) => void
  /** Row content after the position number */
  children: (item: T) => ReactNode
  /** Extra per-row buttons */
  actions?: (item: T) => ReactNode
}) {
  const [dragged, setDragged] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)

  return (
    <ol className='divide-y'>
      {items.map((item, i) => (
        <li
          key={item.id}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move'
            setDragged(i)
          }}
          onDragOver={(e) => {
            if (dragged === null) return // a file from outside; let the drop zone have it
            e.preventDefault()
            setOver(i)
          }}
          onDrop={(e) => {
            if (dragged === null) return
            e.preventDefault()
            e.stopPropagation()
            if (dragged !== i) onChange(move(items, dragged, i))
          }}
          onDragEnd={() => {
            setDragged(null)
            setOver(null)
          }}
          className={cn(
            'flex items-center gap-2 py-1 pr-1 pl-1.5 text-[13px]',
            dragged === i && 'opacity-40',
            over === i && dragged !== i && 'bg-accent',
          )}
        >
          <GripVertical className='size-3.5 shrink-0 cursor-grab text-muted-foreground' aria-hidden />
          <span className='w-5 shrink-0 text-right font-mono text-xs text-muted-foreground'>{i + 1}</span>
          <div className='flex min-w-0 flex-1 items-center gap-2'>{children(item)}</div>
          {actions?.(item)}
          <Button
            size='icon-sm'
            variant='ghost'
            aria-label={`Move ${item.name} up`}
            disabled={i === 0}
            onClick={() => onChange(move(items, i, i - 1))}
          >
            <ArrowUp />
          </Button>
          <Button
            size='icon-sm'
            variant='ghost'
            aria-label={`Move ${item.name} down`}
            disabled={i === items.length - 1}
            onClick={() => onChange(move(items, i, i + 1))}
          >
            <ArrowDown />
          </Button>
          <Button
            size='icon-sm'
            variant='ghost'
            aria-label={`Remove ${item.name}`}
            onClick={() => onChange(items.filter((x) => x !== item))}
          >
            <X />
          </Button>
        </li>
      ))}
    </ol>
  )
}
