import { describe, expect, it } from 'vitest'
import { groupNames, MAX_MATCHES, runRegex } from './regex'

describe('runRegex', () => {
  it('returns all matches with numbered and named groups when global', () => {
    const r = runRegex('(?<year>\\d{4})-(\\d{2})', 'g', 'from 2024-01 to 2025-12')
    expect(r.matches).toEqual([
      { index: 5, text: '2024-01', groups: ['2024', '01'] },
      { index: 16, text: '2025-12', groups: ['2025', '12'] },
    ])
    expect(r.groupNames).toEqual(['year', undefined])
  })

  it('returns only the first match without g', () => {
    expect(runRegex('a', '', 'aaa').matches).toHaveLength(1)
  })

  it('marks non-participating groups as undefined', () => {
    expect(runRegex('(a)|(b)', 'g', 'b').matches[0]?.groups).toEqual([undefined, 'b'])
  })

  it('handles empty matches without looping forever', () => {
    expect(runRegex('x*', 'g', 'ab').matches.map((m) => m.index)).toEqual([0, 1, 2])
  })

  it('applies flags', () => {
    expect(runRegex('^b', 'gim', 'a\nB').matches).toEqual([{ index: 2, text: 'B', groups: [] }])
  })

  it('previews replacement with $ references', () => {
    expect(runRegex('(\\w+)@(\\w+)', 'g', 'a@b c@d', '$2 at $1').replaced).toBe('b at a d at c')
    expect(runRegex('o', '', 'foo', '0').replaced).toBe('f0o')
  })

  it('reports invalid patterns', () => {
    expect(runRegex('(', 'g', 'x').error).toMatch(/Invalid regular expression/)
    expect(runRegex('a', 'gg', 'x').error).toBeTruthy()
  })

  it('names groups in order, skipping non-capturing groups, lookbehinds, escapes and classes', () => {
    expect(groupNames('(?:x)(a)\\((?<n>b)[(](?<=c)(?<!d)(?<m>e)')).toEqual([undefined, 'n', 'm'])
  })

  it('caps the number of matches', () => {
    const r = runRegex('.', 'g', 'x'.repeat(MAX_MATCHES + 5))
    expect(r.matches).toHaveLength(MAX_MATCHES)
    expect(r.truncated).toBe(true)
  })
})
