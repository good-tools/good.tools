import Papa from 'papaparse'

/** Rows of cells under named columns: the common shape every format converts through. */
export interface Table {
  columns: string[]
  rows: unknown[][]
}

export type Delimiter = 'auto' | ',' | '\t' | ';' | '|'
export type JsonShape = 'objects' | 'arrays'

const NUMBER = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/ // no leading zeros: "007" and ZIP codes stay text

/** "42" → 42, "true" → true, "" / "null" → null; anything else stays a string. */
export function inferValue(s: string): unknown {
  if (s === '' || s === 'null') return null
  if (s === 'true' || s === 'false') return s === 'true'
  if (NUMBER.test(s)) {
    const n = Number(s)
    if (Number.isFinite(n) && (!Number.isInteger(n) || Number.isSafeInteger(n))) return n
  }
  return s
}

/** Column names from the first row (blank or repeated names made unique), or column1…N. */
export function tableFromRows(rows: unknown[][], header: boolean): Table {
  const width = Math.max(0, ...rows.map((r) => r.length))
  const first = header ? (rows[0] ?? []) : []
  const seen = new Map<string, number>()
  const columns = Array.from({ length: width }, (_, i) => {
    const name = first[i] == null || first[i] === '' ? `column${i + 1}` : String(first[i])
    const n = seen.get(name) ?? 0
    seen.set(name, n + 1)
    return n ? `${name}_${n + 1}` : name
  })
  const body = header ? rows.slice(1) : rows
  return { columns, rows: body.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? null)) }
}

export function parseCsv(
  text: string,
  opts: { delimiter: Delimiter; header: boolean; infer: boolean },
): { table: Table; delimiter: string } {
  const res = Papa.parse<string[]>(text, {
    delimiter: opts.delimiter === 'auto' ? '' : opts.delimiter,
    delimitersToGuess: [',', '\t', ';', '|'],
    skipEmptyLines: 'greedy',
  })
  // Single-column input has no delimiter to detect; that is fine
  const err = res.errors.find((e) => e.code !== 'UndetectableDelimiter')
  if (err) throw new Error(`${err.row === undefined ? '' : `Row ${err.row + 1}: `}${err.message}`)
  const table = tableFromRows(res.data, opts.header)
  if (opts.infer) table.rows = table.rows.map((r) => r.map((v) => (typeof v === 'string' ? inferValue(v) : v)))
  return { table, delimiter: res.meta.delimiter }
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

/** {a: {b: 1}} → {"a.b": 1}. Arrays stay whole (shown as JSON in their cell). */
export function flatten(obj: Record<string, unknown>, prefix = '', out: Record<string, unknown> = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix + k
    if (isPlainObject(v) && Object.keys(v).length) flatten(v, `${key}.`, out)
    else out[key] = v
  }
  return out
}

/** Array of objects (nested ones flattened to dotted columns), array of arrays, or a single object. */
export function tableFromJson(value: unknown, header: boolean): Table {
  const items = Array.isArray(value) ? value : [value]
  if (items.length && items.every(Array.isArray)) return tableFromRows(items, header)
  if (!items.every(isPlainObject))
    throw new Error('Expected an array of objects, an array of arrays, or a single object')
  const rows = items.map((o) => flatten(o))
  const columns = [...new Set(rows.flatMap(Object.keys))]
  return { columns, rows: rows.map((r) => columns.map((c) => (c in r ? r[c] : null))) }
}

/** Cell value as text for CSV and the preview; null stays null. */
export function cellText(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString().replace(/T00:00:00\.000Z$/, '') // date-only cells
  return typeof v === 'object' ? JSON.stringify(v) : String(v)
}

export function tableToCsv(t: Table, delimiter: string, header: boolean): string {
  const data = t.rows.map((r) => r.map((v) => cellText(v) ?? ''))
  return Papa.unparse(header ? [t.columns, ...data] : data, { delimiter, newline: '\n' })
}

export function tableToJson(t: Table, shape: JsonShape, header: boolean): string {
  const value =
    shape === 'arrays'
      ? header
        ? [t.columns, ...t.rows]
        : t.rows
      : t.rows.map((r) => Object.fromEntries(t.columns.map((c, i) => [c, r[i]])))
  return JSON.stringify(value, null, 2)
}

/** Header row plus cells write-excel-file accepts: strings, numbers, booleans, and nested values as JSON text. */
export function tableToSheet(t: Table, header: boolean) {
  const rows = t.rows.map((r) =>
    r.map((v) => (v == null || typeof v === 'number' || typeof v === 'boolean' ? v : cellText(v))),
  )
  return header ? [t.columns, ...rows] : rows
}
