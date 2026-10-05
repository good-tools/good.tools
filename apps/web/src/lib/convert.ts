import Papa from 'papaparse'
import { parse as parseToml, stringify as stringifyToml, TomlError } from 'smol-toml'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'

export type DataFormat = 'json' | 'yaml' | 'toml' | 'csv'

export function parseData(text: string, format: DataFormat): unknown {
  switch (format) {
    case 'json':
      return JSON.parse(text) // V8's message already ends with "(line L column C)"
    case 'yaml':
      return parseYaml(text) // YAMLParseError message includes "at line L, column C"
    case 'toml':
      try {
        return parseToml(text)
      } catch (e) {
        if (e instanceof TomlError) throw new Error(`Line ${e.line}, column ${e.column}: ${e.message}`)
        throw e
      }
    case 'csv': {
      const { data, errors } = Papa.parse<Record<string, unknown>>(text.trim(), {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
      })
      const err = errors.find((e) => e.code !== 'UndetectableDelimiter') // single-column CSV
      if (err) throw new Error(`${err.row === undefined ? '' : `Row ${err.row + 1}: `}${err.message}`)
      return data
    }
  }
}

export function stringifyData(value: unknown, format: DataFormat): string {
  switch (format) {
    case 'json':
      return JSON.stringify(value, null, 2)
    case 'yaml':
      return stringifyYaml(value)
    case 'toml':
      if (value === null || typeof value !== 'object' || Array.isArray(value))
        throw new Error('TOML needs a table (object) at the top level')
      return stringifyToml(value)
    case 'csv': {
      if (!Array.isArray(value) || !value.every((r) => r !== null && typeof r === 'object' && !Array.isArray(r)))
        throw new Error('CSV needs an array of objects (one per row)')
      // Nested values have no CSV form; keep them as JSON in the cell
      const rows = value.map((r: object) =>
        Object.fromEntries(
          Object.entries(r).map(([k, v]) => [
            k,
            v !== null && typeof v === 'object' && !(v instanceof Date) ? JSON.stringify(v) : v,
          ]),
        ),
      )
      const fields = [...new Set(rows.flatMap(Object.keys))]
      return Papa.unparse(rows, { columns: fields })
    }
  }
}

export const convertData = (text: string, from: DataFormat, to: DataFormat) => stringifyData(parseData(text, from), to)
