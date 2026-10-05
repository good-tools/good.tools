/** SQLite → DuckDB type mapping, shared by the SQLite import worker and its tests. */

export type DuckType = 'BIGINT' | 'DOUBLE' | 'VARCHAR' | 'BLOB'
/** A value as sql.js returns it with `useBigInt`: integers are bigint, reals are number. */
export type SqliteValue = bigint | number | string | Uint8Array | null

/** DuckDB type for a declared SQLite column type, following SQLite's column affinity rules. */
export function affinityType(declared: string): DuckType {
  const t = declared.toUpperCase()
  if (t.includes('INT')) return 'BIGINT'
  if (/CHAR|CLOB|TEXT/.test(t)) return 'VARCHAR'
  if (!t || t.includes('BLOB')) return 'BLOB'
  return 'DOUBLE' // REAL and NUMERIC affinity
}

/**
 * SQLite columns can hold any type whatever they are declared as, so the values decide;
 * the declared type only matters when the column is all NULL.
 */
export function columnType(declared: string, values: SqliteValue[]): DuckType {
  let int = false
  let real = false
  let blob = false
  for (const v of values) {
    if (typeof v === 'bigint') int = true
    else if (typeof v === 'number') real = true
    else if (typeof v === 'string') return 'VARCHAR'
    else if (v) blob = true
  }
  if (blob) return int || real ? 'VARCHAR' : 'BLOB'
  if (real) return 'DOUBLE'
  if (int) return 'BIGINT'
  return affinityType(declared)
}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')

/** Converts a column's values to what an Arrow vector of `type` accepts. */
export function columnValues(type: DuckType, values: SqliteValue[]): unknown[] {
  switch (type) {
    case 'DOUBLE':
      return values.map((v) => (v == null ? null : Number(v)))
    case 'VARCHAR':
      return values.map((v) => (v == null || typeof v === 'string' ? v : v instanceof Uint8Array ? hex(v) : String(v)))
    default:
      return values
  }
}

/** "Chinook.sqlite" → "Chinook": the DuckDB schema the file's tables go in (avoiding built-in schemas). */
export function schemaName(fileName: string): string {
  const base = fileName.replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9_]+/g, '_')
  const name = /^[A-Za-z_]/.test(base) ? base : `_${base}`
  return /^(main|temp|information_schema|pg_catalog)$/i.test(name) ? `${name}_db` : name
}

/** An identifier, quoted only when it has to be. */
export const ident = (s: string) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(s) ? s : `"${s.replace(/"/g, '""')}"`)
