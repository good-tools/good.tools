import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'

/** Virtualized, read-only grid of query/preview rows; null cells show as NULL. */
export function ResultTable({
  columns,
  numRows,
  cell,
}: {
  columns: string[]
  numRows: number
  cell: (row: number, col: number) => string | null
}) {
  const ref = useRef<HTMLDivElement>(null)
  const v = useVirtualizer({
    count: numRows,
    getScrollElement: () => ref.current,
    estimateSize: () => 24,
    overscan: 20,
  })
  const items = v.getVirtualItems()
  const top = items[0]?.start ?? 0
  const bottom = v.getTotalSize() - (items.at(-1)?.end ?? 0)

  return (
    <div ref={ref} className='h-full overflow-auto font-mono text-xs'>
      <table className='min-w-full border-separate border-spacing-0'>
        <thead className='sticky top-0 z-10 bg-muted text-muted-foreground'>
          <tr>
            <th scope='col' className='w-px border-b px-2 py-1 text-right font-medium'>
              #
            </th>
            {columns.map((c, i) => (
              <th key={i} scope='col' className='border-b px-2 py-1 text-left font-medium whitespace-nowrap'>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className='whitespace-nowrap'>
          {top > 0 && <tr style={{ height: top }} />}
          {items.map((row) => (
            <tr key={row.index} className='h-6 hover:bg-muted/50'>
              <td className='border-b px-2 text-right text-muted-foreground'>{row.index + 1}</td>
              {columns.map((_, c) => {
                const text = cell(row.index, c)
                return (
                  <td key={c} title={text ?? undefined} className='max-w-96 truncate border-b px-2'>
                    {text ?? <span className='text-muted-foreground italic'>NULL</span>}
                  </td>
                )
              })}
            </tr>
          ))}
          {bottom > 0 && <tr style={{ height: bottom }} />}
        </tbody>
      </table>
    </div>
  )
}
