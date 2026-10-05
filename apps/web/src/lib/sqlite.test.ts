import { describe, expect, it } from 'vitest'
import { affinityType, columnType, columnValues, ident, schemaName } from './sqlite'

describe('affinityType', () => {
  it('follows SQLite affinity rules', () => {
    expect(affinityType('INTEGER')).toBe('BIGINT')
    expect(affinityType('unsigned big int')).toBe('BIGINT')
    expect(affinityType('NVARCHAR(160)')).toBe('VARCHAR')
    expect(affinityType('CLOB')).toBe('VARCHAR')
    expect(affinityType('')).toBe('BLOB')
    expect(affinityType('BLOB')).toBe('BLOB')
    expect(affinityType('REAL')).toBe('DOUBLE')
    expect(affinityType('NUMERIC(10,2)')).toBe('DOUBLE')
  })
})

describe('columnType', () => {
  it('lets the values win over the declared type', () => {
    expect(columnType('INTEGER', [1n, null, 2n ** 60n])).toBe('BIGINT')
    expect(columnType('NUMERIC(10,2)', [1n, 0.99])).toBe('DOUBLE')
    expect(columnType('INTEGER', [1n, 'n/a'])).toBe('VARCHAR')
    expect(columnType('DATETIME', ['2024-01-01 00:00:00'])).toBe('VARCHAR')
    expect(columnType('', [new Uint8Array([1]), null])).toBe('BLOB')
    expect(columnType('', [new Uint8Array([1]), 1n])).toBe('VARCHAR')
    expect(columnType('TEXT', [null, null])).toBe('VARCHAR')
    expect(columnType('REAL', [])).toBe('DOUBLE')
  })
})

describe('columnValues', () => {
  it('converts values to the column type', () => {
    expect(columnValues('DOUBLE', [1n, 0.5, null])).toEqual([1, 0.5, null])
    expect(columnValues('VARCHAR', ['a', 2n ** 64n, 1.5, new Uint8Array([0, 255]), null])).toEqual([
      'a',
      '18446744073709551616',
      '1.5',
      '00ff',
      null,
    ])
    expect(columnValues('BIGINT', [2n ** 60n, null])).toEqual([2n ** 60n, null])
  })
})

describe('schemaName / ident', () => {
  it('names the schema after the file', () => {
    expect(schemaName('Chinook.sqlite')).toBe('Chinook')
    expect(schemaName('my data.v2.db')).toBe('my_data_v2')
    expect(schemaName('2024.sqlite3')).toBe('_2024')
    expect(schemaName('main.db')).toBe('main_db')
  })
  it('quotes only when needed', () => {
    expect(ident('Album')).toBe('Album')
    expect(ident('Order Details')).toBe('"Order Details"')
    expect(ident('a"b')).toBe('"a""b"')
  })
})
