import { useMemo, useRef } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useVirtual } from '@tanstack/react-virtual'

function PacketVirtualTable({ columns, packets, selectedIndex, setSelectedIndex }) {
  const tableContainerRef = useRef(null)
  const preparedColumns = useMemo(
    () => columns.map((c, i) => {
      return {
        header: c,
        accessorFn: row => row.columns[i],
      }
    }),
    [ columns ]
  )

  const table = useReactTable({
    data: packets,
    columns: preparedColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const { rows } = table.getRowModel()
  const rowVirtualizer = useVirtual({
    parentRef: tableContainerRef,
    size: rows.length,
    overscan: 10,
  })
  const { virtualItems: virtualRows, totalSize } = rowVirtualizer

  const paddingTop = virtualRows.length > 0 ? virtualRows?.[0]?.start || 0 : 0
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows?.[virtualRows.length - 1]?.end || 0)
      : 0
  
  // console.log(rows.length, virtualRows.length, totalSize, paddingTop, paddingBottom)

  return (
    <div className="flex flex-col font-mono h-full">
      <div ref={tableContainerRef} className="overflow-x-hidden">
        <div className="inline-block min-w-full align-middle">
          <div className="dark:bg-zinc-800 shadow dark:shadow-zinc-900 ring-1 ring-black dark:ring-zinc-900 ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50 dark:bg-zinc-700 sticky top-0">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => {
                      return (
                        <th
                          key={header.id}
                          scope="col"
                          className="px-2 py-1 text-left text-sm font-semibold whitespace-nowrap"
                        >
                          {header.isPlaceholder ? null : (
                            <div
                              {...{
                                className: header.column.getCanSort()
                                  ? 'cursor-pointer select-none'
                                  : '',
                                onClick: header.column.getToggleSortingHandler(),
                              }}
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                              {{
                                asc: ' 🔼',
                                desc: ' 🔽',
                              }[header.column.getIsSorted()] ?? null}
                            </div>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600 whitespace-nowrap">
                {paddingTop > 0 && (
                  <tr>
                    <td style={{ height: `${paddingTop}px` }} />
                  </tr>
                )}
                {virtualRows.map(virtualRow => {
                  const selected = virtualRow.index === selectedIndex;
                  const row = rows[virtualRow.index]
                  const p = packets[virtualRow.index]
                  return (
                    <tr key={row.id} onClick={() => setSelectedIndex(virtualRow.index)} className="cursor-pointer leading-0" style={{
                      backgroundColor: selected ? `blue` : p.bg ? `#${p.bg}` : '',
                      color: selected ? `white` : p.fg ? `#${p.fg}` : ''
                    }}>
                      {row.getVisibleCells().map(cell => {
                        return (
                          <td key={cell.id} className="px-2 text-sm">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </td>
                        )
                      })}
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
        </div>
      </div>
    </div>
  )
}

export default PacketVirtualTable;