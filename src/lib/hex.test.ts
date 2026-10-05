import { describe, expect, it } from 'vitest'
import { parseHex } from './hex'

describe('parseHex', () => {
  it('accepts whitespace, 0x prefixes and mixed case', () => {
    expect([...parseHex('0x0A ff\n0XbC')]).toEqual([0x0a, 0xff, 0xbc])
  })
  it('rejects non-hex characters instead of truncating', () => {
    expect(() => parseHex('0a0g01')).toThrow(/"g" at position 4/)
  })
  it('rejects odd length', () => {
    expect(() => parseHex('abc')).toThrow(/odd/)
  })
  it('returns empty buffer for empty input', () => {
    expect(parseHex('  ').length).toBe(0)
  })
})
