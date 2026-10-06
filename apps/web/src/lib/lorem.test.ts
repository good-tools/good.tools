import { describe, expect, it } from 'vitest'
import { countWords, formatLorem, LOREM_START, lorem, MAX } from './lorem'

const sentenceCount = (p: string) => p.split(/(?<=\.) /).length

describe('lorem', () => {
  it('returns the requested number of paragraphs', () => {
    const ps = lorem('paragraphs', 4, false)
    expect(ps).toHaveLength(4)
    for (const p of ps) {
      expect(sentenceCount(p)).toBeGreaterThanOrEqual(4)
      expect(sentenceCount(p)).toBeLessThanOrEqual(8)
    }
  })

  it('returns exact sentence counts as one paragraph', () => {
    const ps = lorem('sentences', 7, false)
    expect(ps).toHaveLength(1)
    expect(sentenceCount(ps[0]!)).toBe(7)
    expect(ps[0]).toMatch(/^[A-Z].*\.$/)
  })

  it.each([1, 3, 5, 8, 50])('returns exactly %i words', (n) => {
    for (const start of [true, false]) {
      const ps = lorem('words', n, start)
      expect(countWords(ps)).toBe(n)
      expect(ps[0]).toMatch(/^[A-Z][a-z ,]*[a-z]\.$/)
    }
  })

  it('optionally starts with the classic opener', () => {
    expect(lorem('paragraphs', 2, true)[0]!.startsWith(`${LOREM_START}.`)).toBe(true)
    expect(lorem('sentences', 3, true)[0]!.startsWith(`${LOREM_START}.`)).toBe(true)
    expect(lorem('words', 2, true)[0]).toBe('Lorem ipsum.')
    expect(lorem('paragraphs', 2, false)[0]!.startsWith('Lorem ipsum dolor sit amet')).toBe(false)
  })

  it('clamps counts', () => {
    expect(lorem('paragraphs', 0, false)).toHaveLength(1)
    expect(lorem('paragraphs', Number.NaN, false)).toHaveLength(1)
    expect(lorem('paragraphs', MAX.paragraphs + 10, false)).toHaveLength(MAX.paragraphs)
  })
})

describe('formatLorem', () => {
  it('formats as text, html and markdown', () => {
    expect(formatLorem(['A.', 'B.'], 'text')).toBe('A.\nB.')
    expect(formatLorem(['A.', 'B.'], 'html')).toBe('<p>A.</p>\n<p>B.</p>')
    expect(formatLorem(['A.', 'B.'], 'markdown')).toBe('A.\n\nB.')
  })
})
