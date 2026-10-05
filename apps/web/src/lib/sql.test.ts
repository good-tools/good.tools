import { describe, expect, it } from 'vitest'
import { cellText, jsonValue, loadSql, type Result, tableName, toCsv, toJson } from './sql'

const result = (columns: string[], rows: unknown[][]): Result => ({
  columns,
  numRows: rows.length,
  get: (r, c) => rows[r]?.[c],
})

describe('tableName', () => {
  it('makes a bare identifier from a file name', () => {
    expect(tableName('Sales 2024.csv')).toBe('Sales_2024')
    expect(tableName('my-data.v2.parquet')).toBe('my_data_v2')
    expect(tableName('2024.json')).toBe('_2024')
  })
})

describe('loadSql', () => {
  it('picks the reader by extension and quotes names', () => {
    expect(loadSql("it's.CSV", 'it_s')).toBe(`CREATE OR REPLACE VIEW "it_s" AS SELECT * FROM read_csv('it''s.CSV')`)
    expect(loadSql('a.ndjson', 'a')).toContain('read_json_auto')
    expect(loadSql('a.parquet', 'a')).toContain('read_parquet')
    expect(() => loadSql('a.sqlite', 'a')).toThrow(/unsupported/)
  })
})

describe('jsonValue / cellText', () => {
  it('converts Arrow-ish values', () => {
    expect(jsonValue(10n)).toBe(10)
    expect(jsonValue(2n ** 64n)).toBe('18446744073709551616')
    expect(jsonValue(new Date(0))).toBe('1970-01-01T00:00:00.000Z')
    expect(jsonValue(new Uint8Array([0, 255]))).toBe('00ff')
    expect(jsonValue({ toJSON: () => [1n, new Int32Array([2])] })).toEqual([1, [2]])
    expect(jsonValue({ toJSON: () => ({ a: 1n }) })).toEqual({ a: 1 })
    expect(cellText(null)).toBeNull()
    expect(cellText({ toJSON: () => ({ a: 'x' }) })).toBe('{"a":"x"}')
    expect(cellText(1.5)).toBe('1.5')
  })
})

describe('export', () => {
  const r = result(
    ['id', 'note'],
    [
      [1n, 'plain'],
      [2n, 'has, "quotes"\nand newline'],
      [3n, null],
    ],
  )
  it('writes RFC 4180 CSV with empty nulls', () => {
    expect(toCsv(r)).toBe('id,note\n1,plain\n2,"has, ""quotes""\nand newline"\n3,\n')
  })
  it('writes an array of objects', () => {
    expect(JSON.parse(toJson(r))).toEqual([
      { id: 1, note: 'plain' },
      { id: 2, note: 'has, "quotes"\nand newline' },
      { id: 3, note: null },
    ])
  })
})
