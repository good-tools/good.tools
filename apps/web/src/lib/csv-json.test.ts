import readXlsx from 'read-excel-file/universal'
import { describe, expect, it } from 'vitest'
import writeXlsx from 'write-excel-file/universal'
import { tools } from '@/config/tools.config'
import { searchTools } from '@/lib/categories'
import {
  cellText,
  inferValue,
  parseCsv,
  tableFromJson,
  tableFromRows,
  tableToCsv,
  tableToJson,
  tableToSheet,
} from './csv-json'

const opts = { delimiter: 'auto', header: true, infer: true } as const

describe('inferValue', () => {
  it.each([
    ['42', 42],
    ['-1.5e3', -1500],
    ['0.25', 0.25],
    ['true', true],
    ['false', false],
    ['', null],
    ['null', null],
    ['007', '007'], // leading zeros: ZIP codes, IDs
    ['1,5', '1,5'],
    ['9007199254740993', '9007199254740993'], // beyond safe integers
    ['TRUE', 'TRUE'],
  ])('%j → %j', (s, v) => expect(inferValue(s)).toEqual(v))
})

describe('parseCsv', () => {
  it('detects the delimiter and types values', () => {
    const { table, delimiter } = parseCsv('a;b;c\n1;"x;y";true\n02134;;null\n', opts)
    expect(delimiter).toBe(';')
    expect(table).toEqual({
      columns: ['a', 'b', 'c'],
      rows: [
        [1, 'x;y', true],
        ['02134', null, null],
      ],
    })
  })

  it('detects tabs and keeps strings when inference is off', () => {
    const { table, delimiter } = parseCsv('a\tb\n1\ttrue', { ...opts, infer: false })
    expect(delimiter).toBe('\t')
    expect(table.rows).toEqual([['1', 'true']])
  })

  it('names columns without a header row, pads short rows and dedupes names', () => {
    expect(parseCsv('1,2,3\n4', { ...opts, header: false }).table).toEqual({
      columns: ['column1', 'column2', 'column3'],
      rows: [
        [1, 2, 3],
        [4, null, null],
      ],
    })
    expect(tableFromRows([['id', '', 'id']], true).columns).toEqual(['id', 'column2', 'id_2'])
  })

  it('reports where a quote is broken', () => {
    expect(() => parseCsv('a,b\n1,"oops\n', opts)).toThrow(/^Row 2: /)
  })
})

describe('JSON → table', () => {
  it('flattens nested objects to dotted columns and unions keys', () => {
    const t = tableFromJson(
      [
        { id: 1, user: { name: 'Ada', geo: { lat: 1 } }, tags: ['a'] },
        { id: 2, extra: true },
      ],
      true,
    )
    expect(t.columns).toEqual(['id', 'user.name', 'user.geo.lat', 'tags', 'extra'])
    expect(tableToCsv(t, ',', true)).toBe('id,user.name,user.geo.lat,tags,extra\n1,Ada,1,"[""a""]",\n2,,,,true')
  })

  it('takes arrays of arrays (first row as header) and single objects', () => {
    expect(
      tableFromJson(
        [
          ['a', 'b'],
          [1, 2],
        ],
        true,
      ),
    ).toEqual({ columns: ['a', 'b'], rows: [[1, 2]] })
    expect(tableFromJson({ a: 1 }, true)).toEqual({ columns: ['a'], rows: [[1]] })
    expect(() => tableFromJson([1, 2], true)).toThrow(/array of objects/)
  })

  it('writes TSV without a header', () => {
    expect(tableToCsv(tableFromJson([{ a: 'x', b: 1 }], true), '\t', false)).toBe('x\t1')
  })
})

describe('table → JSON', () => {
  const t = parseCsv('name,n\nAda,1\n', opts).table
  it('as objects or arrays', () => {
    expect(JSON.parse(tableToJson(t, 'objects', true))).toEqual([{ name: 'Ada', n: 1 }])
    expect(JSON.parse(tableToJson(t, 'arrays', true))).toEqual([
      ['name', 'n'],
      ['Ada', 1],
    ])
    expect(JSON.parse(tableToJson(t, 'arrays', false))).toEqual([['Ada', 1]])
  })
})

it('shows sheet dates without a midnight time', () => {
  expect(cellText(new Date('2026-01-05'))).toBe('2026-01-05')
  expect(cellText(new Date('2026-01-05T10:30:00Z'))).toBe('2026-01-05T10:30:00.000Z')
})

it('round-trips a table through .xlsx', async () => {
  const t = tableFromJson([{ name: 'Ada', n: 1.5, ok: true, nested: { x: [1] }, none: null }], true)
  const blob = await writeXlsx(tableToSheet(t, true) as never, { sheet: 'People' }).toBlob()
  const [sheet] = await readXlsx(await blob.arrayBuffer())
  expect(sheet?.sheet).toBe('People')
  expect(tableFromRows((sheet?.data ?? []) as unknown[][], true)).toEqual({
    columns: ['name', 'n', 'ok', 'nested.x', 'none'],
    rows: [['Ada', 1.5, true, '[1]', null]],
  })
})

it('is the top search result for conversion queries', () => {
  for (const q of ['csv to json', 'json to csv', 'excel to json', 'xlsx to csv'])
    expect(searchTools(tools, q)[0]?.path).toBe('/csv-json')
})
