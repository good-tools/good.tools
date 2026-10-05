/** DuckDB-WASM (in its own worker) for the SQL Query tool. */
import { AsyncDuckDB, type AsyncDuckDBConnection, DuckDBDataProtocol, VoidLogger } from '@duckdb/duckdb-wasm'
import workerUrl from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'
import { fetchInflated } from '@/lib/fetch-inflated'
import { ident, schemaName } from '@/lib/sqlite'
import type { SqliteRequest, SqliteResponse } from '@/workers/sqlite.worker'

let ready: Promise<{ db: AsyncDuckDB; conn: AsyncDuckDBConnection }> | undefined

/** Starts DuckDB on first use; the instance lives for the rest of the session. */
export function duck() {
  ready ??= (async () => {
    // The 34 MB wasm is shipped gzipped (8 MB); hand the inflated bytes to the worker as a blob URL
    const { default: wasmUrl } = await import('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?gzip')
    const url = URL.createObjectURL(new Blob([await fetchInflated(wasmUrl)], { type: 'application/wasm' }))
    const db = new AsyncDuckDB(new VoidLogger(), new Worker(workerUrl, { type: 'module' }))
    try {
      await db.instantiate(url)
    } finally {
      URL.revokeObjectURL(url)
    }
    await db.open({ query: { castDecimalToDouble: true } })
    return { db, conn: await db.connect() }
  })().catch((e) => {
    ready = undefined
    throw e
  })
  return ready
}

const quoteId = (s: string) => `"${s.replace(/"/g, '""')}"`
const quoteStr = (s: string) => `'${s.replace(/'/g, "''")}'`

/** "Sales 2024.csv" → "Sales_2024": a name you can type without quotes. */
export function tableName(fileName: string): string {
  const base = fileName.replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9_]+/g, '_')
  return /^[A-Za-z_]/.test(base) ? base : `_${base}`
}

/** SQL that exposes `fileName` (already registered with DuckDB) as `name`, by file extension. */
export function loadSql(fileName: string, name: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase()
  const src = quoteStr(fileName)
  const view = (fn: string) => `CREATE OR REPLACE VIEW ${quoteId(name)} AS SELECT * FROM ${fn}(${src})`
  switch (ext) {
    case 'csv':
    case 'tsv':
    case 'txt':
      return view('read_csv')
    case 'json':
    case 'ndjson':
    case 'jsonl':
      return view('read_json_auto')
    case 'parquet':
      return view('read_parquet')
    default:
      throw new Error(`${fileName}: unsupported file type (use CSV, TSV, JSON, NDJSON, Parquet or SQLite)`)
  }
}

export const isSqlite = (fileName: string) => /\.(db|sqlite3?)$/i.test(fileName)

/**
 * Copies every table of a SQLite file into a DuckDB schema named after the file; returns the first table.
 * (DuckDB's own sqlite extension can't read browser-registered files, so sql.js reads it in a worker.)
 */
async function loadSqlite(file: File, progress: (msg: string) => void): Promise<string> {
  const { conn } = await duck()
  const worker = new Worker(new URL('../workers/sqlite.worker.ts', import.meta.url), { type: 'module' })
  const ask = <T extends SqliteResponse>(req: SqliteRequest) =>
    new Promise<T>((resolve, reject) => {
      worker.onmessage = ({ data }: MessageEvent<SqliteResponse>) =>
        'error' in data ? reject(new Error(`${file.name}: ${data.error}`)) : resolve(data as T)
      worker.onerror = (e) => reject(new Error(e.message || 'SQLite worker failed'))
      worker.postMessage(req)
    })
  try {
    progress(`Opening ${file.name}…`)
    const { tables } = await ask<{ tables: string[] }>({ file })
    if (!tables.length) throw new Error(`${file.name}: no tables`)
    const schema = schemaName(file.name)
    await conn.query(`DROP SCHEMA IF EXISTS ${ident(schema)} CASCADE; CREATE SCHEMA ${ident(schema)}`)
    for (const [i, table] of tables.entries()) {
      progress(`Importing ${table} (${i + 1}/${tables.length})…`)
      const { columns, rows, ipc } = await ask<Extract<SqliteResponse, { ipc: Uint8Array }>>({ table })
      const cols = columns.map((c) => `${ident(c.name)} ${c.type}`).join(', ')
      await conn.query(`CREATE TABLE ${ident(schema)}.${ident(table)} (${cols})`)
      if (rows) await conn.insertArrowFromIPCStream(ipc, { schema, name: table, create: false })
    }
    return `${ident(schema)}.${ident(tables[0]!)}`
  } finally {
    worker.terminate() // frees the sql.js database
  }
}

/** Registers `file` (read lazily, not copied) and creates its table(s); returns the table to show first. */
export async function loadFile(file: File, progress: (msg: string) => void = () => {}): Promise<string> {
  if (isSqlite(file.name)) return loadSqlite(file, progress)
  const { db, conn } = await duck()
  const name = tableName(file.name)
  const sql = loadSql(file.name, name)
  await db.registerFileHandle(file.name, file, DuckDBDataProtocol.BROWSER_FILEREADER, true)
  await conn.query(sql)
  return name
}

export interface TableInfo {
  name: string
  columns: { name: string; type: string }[]
}

/** Every user table and view, with its columns. */
export async function listTables(): Promise<TableInfo[]> {
  const { conn } = await duck()
  const res = await conn.query(`
    SELECT if(table_schema = 'main', table_name, table_schema || '.' || table_name) AS name,
      list(column_name ORDER BY ordinal_position) AS names, list(data_type ORDER BY ordinal_position) AS types
    FROM information_schema.columns WHERE table_catalog = current_database() GROUP BY ALL ORDER BY name`)
  return res.toArray().map((r) => {
    const types: string[] = r.types.toArray()
    return { name: r.name, columns: (r.names.toArray() as string[]).map((n, i) => ({ name: n, type: types[i] ?? '' })) }
  })
}

/** Query result in a shape that doesn't depend on Arrow, so formatting/export can be tested. */
export interface Result {
  columns: string[]
  numRows: number
  get(row: number, col: number): unknown
}

export async function runQuery(sql: string): Promise<Result> {
  const { conn } = await duck()
  const table = await conn.query(sql)
  // Arrow gives DATE and TIMESTAMP values as epoch milliseconds
  const getters = table.schema.fields.map((f, i) => {
    const vector = table.getChildAt(i)
    const type = String(f.type)
    const iso = (row: number, len?: number) => {
      const v = vector?.get(row)
      return v == null ? v : new Date(Number(v)).toISOString().slice(0, len)
    }
    if (type.startsWith('Date')) return (row: number) => iso(row, 10)
    if (type.startsWith('Timestamp')) return (row: number) => iso(row)
    return (row: number) => vector?.get(row)
  })
  return {
    columns: table.schema.fields.map((f) => f.name),
    numRows: table.numRows,
    get: (row, col) => getters[col]?.(row),
  }
}

/** Arrow cell → plain JSON value (BigInt as number when exact, nested lists/structs unwrapped). */
export function jsonValue(v: unknown): unknown {
  if (v == null) return null
  if (typeof v === 'bigint') return Number.isSafeInteger(Number(v)) ? Number(v) : v.toString()
  if (v instanceof Date) return v.toISOString()
  if (v instanceof Uint8Array) return Array.from(v, (b) => b.toString(16).padStart(2, '0')).join('')
  if (typeof v === 'object') {
    // Arrow lists/structs/maps all have toJSON()
    const plain = 'toJSON' in v && typeof v.toJSON === 'function' ? v.toJSON() : v
    if (Array.isArray(plain) || ArrayBuffer.isView(plain)) return Array.from(plain as ArrayLike<unknown>, jsonValue)
    return Object.fromEntries(Object.entries(plain as object).map(([k, x]) => [k, jsonValue(x)]))
  }
  return v
}

/** Text for a cell; null stays null so callers choose how to show it. */
export function cellText(v: unknown): string | null {
  const j = jsonValue(v)
  if (j === null) return null
  return typeof j === 'object' ? JSON.stringify(j) : String(j)
}

export function toCsv(r: Result): string {
  const field = (s: string | null) => (s === null ? '' : /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const lines = [r.columns.map(field).join(',')]
  for (let i = 0; i < r.numRows; i++) lines.push(r.columns.map((_, c) => field(cellText(r.get(i, c)))).join(','))
  return `${lines.join('\n')}\n`
}

export function toJson(r: Result): string {
  const rows = Array.from({ length: r.numRows }, (_, i) =>
    Object.fromEntries(r.columns.map((name, c) => [name, jsonValue(r.get(i, c))])),
  )
  return JSON.stringify(rows, null, 2)
}
