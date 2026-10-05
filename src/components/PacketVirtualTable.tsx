import { useInfiniteQuery } from '@tanstack/react-query'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useIsDark } from '@/stores/theme.store'

const fetchSize = 200

interface PacketRow {
  number: number
  columns: string[]
  bg?: number
  fg?: number
}

interface PacketVirtualTableProps {
  columns: string[]
  fileName: string
  filter: string
  fetchPackets: (filter: string, start: number, count: number) => Promise<PacketRow[]>
  total: number
  selectedFrame: number
  setSelectedFrame: (frame: number) => void
  dissectionNonce: number
}

function PacketVirtualTable({
  columns,
  fileName,
  filter,
  fetchPackets,
  total,
  selectedFrame,
  setSelectedFrame,
  dissectionNonce,
}: PacketVirtualTableProps) {
  const isDark = useIsDark()
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const preparedColumns = useMemo(
    () =>
      columns.map((c, i) => {
        return {
          header: c,
          accessorFn: (row: PacketRow) => row.columns[i],
        }
      }),
    [columns],
  )

  const { data, fetchNextPage, isFetching } = useInfiniteQuery({
    queryKey: ['packet-data', fileName, filter, dissectionNonce],
    queryFn: async ({ pageParam = 0 }) => {
      const start = pageParam * fetchSize
      const fetchedData = await fetchPackets(filter, start, fetchSize)
      return fetchedData
    },
    getNextPageParam: (_lastGroup: PacketRow[], groups: PacketRow[][]) => groups.length,
    refetchOnWindowFocus: false,
    initialPageParam: 0,
  })

  const flatData = useMemo(() => data?.pages?.flat() ?? [], [data])

  const totalDBRowCount = total ?? 0
  const totalFetched = flatData.length

  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement
        //once the user has scrolled within 300px of the bottom of the table, fetch more data if there is any
        if (scrollHeight - scrollTop - clientHeight < 300 && !isFetching && totalFetched < totalDBRowCount) {
          void fetchNextPage()
        }
      }
    },
    [fetchNextPage, isFetching, totalFetched, totalDBRowCount],
  )

  //a check on mount and after a fetch to see if the table is already scrolled to the bottom and immediately needs to fetch more data
  useEffect(() => {
    fetchMoreOnBottomReached(tableContainerRef.current)
  }, [fetchMoreOnBottomReached])

  const table = useReactTable({
    data: flatData,
    columns: preparedColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  const { rows } = table.getRowModel()
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 24,
    overscan: 10,
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()

  const paddingTop = virtualRows.length > 0 ? virtualRows?.[0]?.start || 0 : 0
  const paddingBottom = virtualRows.length > 0 ? totalSize - (virtualRows?.[virtualRows.length - 1]?.end || 0) : 0

  const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`

  // ↑/↓ move the selection while the table has focus
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const idx = flatData.findIndex((p) => p.number === selectedFrame)
    const next = flatData[Math.min(Math.max(idx + step, 0), flatData.length - 1)]
    if (!next) return
    setSelectedFrame(next.number)
    rowVirtualizer.scrollToIndex(flatData.indexOf(next))
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: focusable scroll region; ↑/↓ move the packet selection
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: focusable scroll region; ↑/↓ move the packet selection
    <div
      ref={tableContainerRef}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: focusable scroll region; ↑/↓ move the packet selection
      tabIndex={0}
      aria-label='Packets (use ↑/↓ to select)'
      onKeyDown={onKeyDown}
      onScroll={(e) => fetchMoreOnBottomReached(e.target as HTMLDivElement)}
      className='h-full overflow-auto rounded-md border bg-card font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring'
    >
      <table className='min-w-full'>
        <thead className='sticky top-0 z-10 bg-muted text-muted-foreground'>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  scope='col'
                  className='border-b px-2 py-1.5 text-left font-medium whitespace-nowrap'
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className='whitespace-nowrap'>
          {paddingTop > 0 && (
            <tr>
              <td style={{ height: `${paddingTop}px` }} />
            </tr>
          )}
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index]
            const p = flatData[virtualRow.index]
            if (!row || !p) return null
            const selected = p.number === selectedFrame
            return (
              <tr
                key={row.id}
                aria-selected={selected}
                onClick={() => setSelectedFrame(p.number)}
                className={cn('h-6 cursor-default', selected && 'bg-primary text-primary-foreground')}
                // Wireshark's colouring rules are pastel backgrounds meant for light UIs; in dark mode
                // tint the row instead and keep our own text colour
                style={
                  selected || !p.bg
                    ? undefined
                    : isDark
                      ? { backgroundColor: `color-mix(in oklch, ${hex(p.bg)} 16%, var(--card))` }
                      : { backgroundColor: hex(p.bg), color: p.fg ? hex(p.fg) : undefined }
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className='px-2'>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            )
          })}
          {paddingBottom > 0 && (
            <tr>
              <td style={{ height: `${paddingBottom}px` }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default PacketVirtualTable
export type { PacketRow }
