import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronRight } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface JsonRow {
  path: string
  depth: number
  key?: string | number
  value: unknown
  /** Number of children for objects/arrays, undefined for primitives */
  size?: number
}

/** Marker value for a reference back to an ancestor */
export const CIRCULAR = Symbol('circular')

const isContainer = (v: unknown): v is object => typeof v === 'object' && v !== null

/** JSONPath for a child: `.key` when it's an identifier, `['key']` otherwise, `[n]` for array items. */
export function childPath(parent: string, key: string | number) {
  if (typeof key === 'number') return `${parent}[${key}]`
  return /^[A-Za-z_$][\w$]*$/.test(key)
    ? `${parent}.${key}`
    : `${parent}['${key.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}']`
}

/** The visible rows of the tree, depth first, descending only into expanded containers. */
export function flattenJson(value: unknown, isOpen: (row: JsonRow) => boolean): JsonRow[] {
  const rows: JsonRow[] = []
  const ancestors = new Set<object>()
  const walk = (value: unknown, path: string, depth: number, key?: string | number) => {
    // Object graphs (e.g. deserialized Java) can point back at an ancestor
    if (isContainer(value) && ancestors.has(value)) {
      rows.push({ path, depth, key, value: CIRCULAR })
      return
    }
    const entries = isContainer(value) ? Object.entries(value) : undefined
    const row: JsonRow = { path, depth, key, value, size: entries?.length }
    rows.push(row)
    if (!entries || !isOpen(row)) return
    ancestors.add(value as object)
    const array = Array.isArray(value)
    for (const [k, v] of entries) {
      const childKey = array ? Number(k) : k
      walk(v, childPath(path, childKey), depth + 1, childKey)
    }
    ancestors.delete(value as object)
  }
  walk(value, '$', 0)
  return rows
}

/** Paths of every object/array in the value (for "expand all"). */
export function containerPaths(value: unknown): string[] {
  return flattenJson(value, () => true)
    .filter((r) => r.size !== undefined)
    .map((r) => r.path)
}

function Primitive({ value }: { value: unknown }) {
  if (value === CIRCULAR) return <span className='text-muted-foreground italic'>[circular]</span>
  if (typeof value === 'string') return <span className='json-string'>"{value}"</span>
  if (typeof value === 'number') return <span className='json-number'>{value}</span>
  return <span className='json-literal'>{String(value)}</span>
}

function Summary({ value, size }: { value: object; size: number }) {
  const array = Array.isArray(value)
  return (
    <span className='text-muted-foreground'>
      {array ? '[' : '{'}
      {size ? '…' : ''}
      {array ? ']' : '}'}{' '}
      <span className='text-[11px]'>
        {size === 1 ? `1 ${array ? 'item' : 'key'}` : `${size} ${array ? 'items' : 'keys'}`}
      </span>
    </span>
  )
}

const ROW = 20

/**
 * Expansion state for a JsonTree. Starts fully expanded for small values (up to `expandAllBelow` nodes),
 * otherwise `depth` levels deep. Resets to that default when the value's shape changes.
 */
export function useJsonTree(value: unknown, { depth = 2, expandAllBelow = 2000 } = {}) {
  const all = useMemo(() => flattenJson(value, () => true), [value])
  const containers = useMemo(() => all.filter((r) => r.size !== undefined), [all])
  const shape = useMemo(() => containers.map((r) => r.path).join('\n'), [containers])
  const initial = useMemo(
    () => new Set(containers.filter((r) => all.length <= expandAllBelow || r.depth < depth).map((r) => r.path)),
    [containers, all.length, expandAllBelow, depth],
  )
  const [user, setUser] = useState<{ shape: string; expanded: Set<string> }>()
  const expanded = user?.shape === shape ? user.expanded : initial
  const set = (next: Set<string>) => setUser({ shape, expanded: next })
  return {
    expanded,
    toggle: (path: string) => {
      const next = new Set(expanded)
      if (!next.delete(path)) next.add(path)
      set(next)
    },
    expandAll: () => set(new Set(containers.map((r) => r.path))),
    collapseAll: () => set(new Set(['$'])),
  }
}

export type JsonTreeState = ReturnType<typeof useJsonTree>

/** Virtualized, collapsible JSON tree. `expanded` holds the JSONPaths of open containers. */
export function JsonTree({
  value,
  state,
  selected,
  onSelect,
}: {
  value: unknown
  state: JsonTreeState
  selected?: string
  onSelect?: (path: string) => void
}) {
  const { expanded, toggle: onToggle } = state
  const rows = useMemo(() => flattenJson(value, (r) => expanded.has(r.path)), [value, expanded])
  const scroller = useRef<HTMLDivElement>(null)
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW,
    overscan: 20,
  })

  return (
    <div
      ref={scroller}
      role='tree'
      aria-label='JSON tree'
      className='json-tree h-full overflow-auto py-1 font-mono text-xs'
    >
      <div className='relative' style={{ height: virtual.getTotalSize() }}>
        {virtual.getVirtualItems().map((item) => {
          const row = rows[item.index] as JsonRow
          const open = expanded.has(row.path)
          // Empty objects/arrays render as {} / [] with nothing to expand
          const container = !!row.size
          return (
            <div
              key={row.path}
              role='treeitem'
              aria-expanded={container ? open : undefined}
              aria-selected={selected === row.path}
              tabIndex={-1}
              onClick={() => {
                onSelect?.(row.path)
                if (container) onToggle(row.path)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && container) onToggle(row.path)
              }}
              className={cn(
                'absolute inset-x-0 flex cursor-default items-center pr-3 whitespace-nowrap hover:bg-accent',
                selected === row.path && 'bg-accent',
              )}
              style={{ height: ROW, transform: `translateY(${item.start}px)`, paddingLeft: row.depth * 16 + 6 }}
            >
              <ChevronRight
                className={cn(
                  'mr-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform',
                  open && 'rotate-90',
                  !container && 'invisible',
                )}
              />
              {row.key !== undefined && (
                <>
                  <span className={typeof row.key === 'number' ? 'text-muted-foreground' : 'json-key'}>{row.key}</span>
                  <span className='mr-1.5 text-muted-foreground'>:</span>
                </>
              )}
              <span className='truncate'>
                {row.size === 0 ? (
                  <span className='text-muted-foreground'>{Array.isArray(row.value) ? '[]' : '{}'}</span>
                ) : container ? (
                  open ? (
                    <span className='text-[11px] text-muted-foreground'>
                      {Array.isArray(row.value) ? `[${row.size}]` : `{${row.size}}`}
                    </span>
                  ) : (
                    <Summary value={row.value as object} size={row.size as number} />
                  )
                ) : (
                  <Primitive value={row.value} />
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
