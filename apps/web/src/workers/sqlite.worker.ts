/** Opens a SQLite file with sql.js and hands its tables over one at a time as Arrow IPC, for DuckDB to insert. */
import { Binary, type DataType, Float64, Int64, Table, tableToIPC, Utf8, vectorFromArray } from 'apache-arrow'
import initSqlJs, { type Database } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url'
import { columnType, columnValues, type DuckType, type SqliteValue } from '@/lib/sqlite'

export type SqliteRequest = { file: File } | { table: string }
export type SqliteResponse =
  | { tables: string[] }
  | { columns: { name: string; type: DuckType }[]; rows: number; ipc: Uint8Array }
  | { error: string }

const ARROW: Record<DuckType, () => DataType> = {
  BIGINT: () => new Int64(),
  DOUBLE: () => new Float64(),
  VARCHAR: () => new Utf8(),
  BLOB: () => new Binary(),
}
const quoteId = (s: string) => `"${s.replace(/"/g, '""')}"`
let db: Database

function exportTable(table: string): SqliteResponse {
  const info = db.exec(`PRAGMA table_info(${quoteId(table)})`)[0]?.values ?? []
  const names = info.map((c) => String(c[1]))
  const cols: SqliteValue[][] = names.map(() => [])
  // ponytail: a whole table is held in memory at once; batch rows if multi-GB tables matter
  const stmt = db.prepare(`SELECT * FROM ${quoteId(table)}`)
  while (stmt.step()) {
    // @types/sql.js predates the config argument
    const row = (stmt as unknown as { get(p: null, c: { useBigInt: boolean }): unknown[] }).get(null, {
      useBigInt: true,
    })
    for (let i = 0; i < row.length; i++) cols[i]?.push(row[i] as SqliteValue)
  }
  stmt.free()
  const types = cols.map((values, i) => columnType(String(info[i]?.[2] ?? ''), values))
  // Positional c0, c1… keys: the DuckDB table is created up front and filled by position
  const arrow = new Table(
    Object.fromEntries(
      cols.map((values, i) => [`c${i}`, vectorFromArray(columnValues(types[i]!, values), ARROW[types[i]!]())]),
    ),
  )
  return {
    columns: names.map((name, i) => ({ name, type: types[i]! })),
    rows: cols[0]?.length ?? 0,
    ipc: tableToIPC(arrow, 'stream'),
  }
}

self.onmessage = async ({ data }: MessageEvent<SqliteRequest>) => {
  try {
    if ('file' in data) {
      const SQL = await initSqlJs({ locateFile: () => wasmUrl })
      db = new SQL.Database(new Uint8Array(await data.file.arrayBuffer()))
      const res = db.exec(
        `SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND sql NOT LIKE 'CREATE VIRTUAL%' ORDER BY name`,
      )
      self.postMessage({ tables: (res[0]?.values ?? []).map((r) => String(r[0])) } satisfies SqliteResponse)
    } else {
      const res = exportTable(data.table)
      self.postMessage(res, 'ipc' in res ? [res.ipc.buffer] : [])
    }
  } catch (e) {
    self.postMessage({ error: e instanceof Error ? e.message : String(e) } satisfies SqliteResponse)
  }
}
