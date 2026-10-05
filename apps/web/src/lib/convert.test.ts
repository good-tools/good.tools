import { describe, expect, it } from 'vitest'
import { convertData, parseData } from './convert'

describe('parse errors point at the location', () => {
  it.each([
    ['json', '{"a": 1,\n  "b" 2}', /line 2 column 7/],
    ['yaml', 'a: 1\n  b: 2', /at line 1, column 4/],
    ['toml', 'a = 1\nb = \n', /^Line 2, column 5:/],
    ['csv', 'a,b\n1,2\n3', /^Row 2: /],
  ] as const)('%s', (format, text, location) => {
    expect(() => parseData(text, format)).toThrow(location)
  })
})

describe('convertData', () => {
  it('TOML → YAML', () => {
    expect(convertData('title = "x"\n[owner]\nname = "Tom"\n[[items]]\nn = 1\n', 'toml', 'yaml')).toBe(
      'title: x\nowner:\n  name: Tom\nitems:\n  - n: 1\n',
    )
  })

  it('YAML → TOML', () => {
    expect(convertData('server:\n  port: 8080\n  hosts: [a, b]\n', 'yaml', 'toml')).toBe(
      '[server]\nport = 8080\nhosts = [ "a", "b" ]\n',
    )
  })

  it('JSON → CSV keeps nested values as JSON and unions the columns', () => {
    expect(convertData('[{"a":1,"b":{"c":2}},{"a":"x,y","d":null}]', 'json', 'csv')).toBe(
      'a,b,d\r\n1,"{""c"":2}",\r\n"x,y",,',
    )
  })

  it('CSV → JSON types numbers and booleans', () => {
    expect(JSON.parse(convertData('a,b\n1,true\n"x,y",\n', 'csv', 'json'))).toEqual([
      { a: 1, b: true },
      { a: 'x,y', b: null },
    ])
  })

  it('rejects shapes the target cannot hold', () => {
    expect(() => convertData('[1, 2]', 'json', 'toml')).toThrow(/table/)
    expect(() => convertData('{"a": 1}', 'json', 'csv')).toThrow(/array of objects/)
  })
})
