import { describe, expect, it } from 'vitest'
import { CIRCULAR, childPath, containerPaths, flattenJson } from './JsonTree'

const doc = { a: 1, 'b c': [true, { d: null }] }

describe('JsonTree helpers', () => {
  it('builds JSONPaths that jsonpath can query', () => {
    expect(childPath('$', 'a')).toBe('$.a')
    expect(childPath('$', "it's")).toBe("$['it\\'s']")
    expect(childPath('$.x', 3)).toBe('$.x[3]')
  })

  it('only descends into open containers', () => {
    expect(flattenJson(doc, (r) => r.path === '$').map((r) => [r.path, r.depth, r.size])).toEqual([
      ['$', 0, 2],
      ['$.a', 1, undefined],
      ["$['b c']", 1, 2],
    ])
    expect(flattenJson(doc, () => true).map((r) => r.path)).toEqual([
      '$',
      '$.a',
      "$['b c']",
      "$['b c'][0]",
      "$['b c'][1]",
      "$['b c'][1].d",
    ])
  })

  it('lists every container for expand all', () => {
    expect(containerPaths(doc)).toEqual(['$', "$['b c']", "$['b c'][1]"])
    expect(containerPaths(5)).toEqual([])
  })
})

it('stops at references back to an ancestor', () => {
  const a: Record<string, unknown> = { name: 'a' }
  a.self = a
  expect(flattenJson(a, () => true).map((r) => [r.path, r.value === CIRCULAR])).toEqual([
    ['$', false],
    ['$.name', false],
    ['$.self', true],
  ])
})
