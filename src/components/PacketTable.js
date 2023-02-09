function PacketTable({ columns, packets, selectedIndex, setSelectedIndex }) {
  return (
    <div className="my-2 flex flex-col font-mono overflow-y-auto h-full">
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full py-2 align-middle">
          <div className="dark:bg-zinc-800 shadow dark:shadow-zinc-900 ring-1 ring-black dark:ring-zinc-900 ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50 dark:bg-zinc-700 sticky top-0">
                <tr>
                  {columns.map((c, i) => (
                    <th
                      key={`c-${i}`}
                      scope="col"
                      className="px-2 py-1 text-left text-sm font-semibold"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600 whitespace-nowrap">
                {packets.map((p, i) => {
                  const selected = i === selectedIndex;
                  return (
                    <tr key={`k-${i}`} onClick={() => setSelectedIndex(i)} className="cursor-pointer leading-0" style={{
                        backgroundColor: selected ? `blue` : p.bg ? `#${p.bg}` : '',
                        color: selected ? `white` : p.fg ? `#${p.fg}` : ''
                    }}>
                      {p.columns.map((c, j) => (
                        <td key={`p-${i}-c-${j}`} className="px-2 text-sm">
                          {c}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PacketTable;