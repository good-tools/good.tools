import { beforeEach, describe, expect, it } from 'vitest'
import { applyJsonPath, stringify, useJSONFormatterStore } from './json-formatter.store'

const s = () => useJSONFormatterStore.getState()

beforeEach(() => s().reset())

describe('json formatter store', () => {
  it('clearing the input drops the parsed value and error', () => {
    s().setValue('{"a":')
    expect(s().error).toBeTruthy()
    s().setValue('')
    expect(s().error).toBeNull()
    expect(s().parsed).toBeUndefined()
  })

  it('invalid input does not keep the previous parsed value', () => {
    s().setValue('{"a":1}')
    expect(s().parsed).toEqual({ a: 1 })
    s().setValue('{"a":}')
    expect(s().parsed).toBeUndefined()
    expect(s().error).toMatch(/JSON/)
  })

  it('reports invalid JSONPath instead of keeping the old result', () => {
    expect(applyJsonPath({ a: 1 }, '$.a')).toEqual({ result: [1], error: null })
    const bad = applyJsonPath({ a: 1 }, '$[')
    expect(bad.error).toBeTruthy()
    expect(bad.result).toBeUndefined()
  })
})

it('formats with the chosen indent and optional key sorting', () => {
  const v = { b: [{ z: 1, a: 2 }], a: 1 }
  expect(stringify(v, 'none', true)).toBe('{"a":1,"b":[{"a":2,"z":1}]}')
  expect(stringify({ a: 1 }, 'tab')).toBe('{\n\t"a": 1\n}')
  expect(stringify({ a: 1 }, '4')).toBe('{\n    "a": 1\n}')
})
