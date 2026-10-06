import { describe, expect, it } from 'vitest'
import { formatDuration, keywordDensity as kd, sentenceWords, textStats } from './text-stats'

const keywordDensity = (text: string, n: 1 | 2 | 3, stop: boolean) => kd(sentenceWords(text), n, stop)

describe('textStats', () => {
  it('counts English text', () => {
    const text = "Hello, world! It's a fine day.\n\nSecond paragraph here.\nNew line."
    const s = textStats(text)
    expect(s).toMatchObject({ words: 11, sentences: 4, paragraphs: 2, lines: 4, uniqueWords: 11 })
    expect(s.characters).toBe(text.length)
    expect(s.charactersNoSpaces).toBe(text.replace(/\s/g, '').length)
  })

  it('is zero for empty and whitespace-only input', () => {
    expect(textStats('')).toMatchObject({ words: 0, characters: 0, sentences: 0, paragraphs: 0, lines: 0 })
    expect(textStats('  \n ')).toMatchObject({
      words: 0,
      characters: 4,
      charactersNoSpaces: 0,
      paragraphs: 0,
      lines: 2,
    })
  })

  it('counts graphemes, not UTF-16 units: emoji sequences and accents are one character, not words', () => {
    const s = textStats('👨‍👩‍👧 é 🇯🇵')
    expect(s.characters).toBe(5)
    expect(s.words).toBe(1)
  })

  it('splits CJK into words', () => {
    expect(textStats('我爱北京天安门').words).toBeGreaterThan(1)
    expect(textStats('私は学生です').words).toBeGreaterThan(1)
  })

  it('treats case-insensitive repeats as one unique word and averages length', () => {
    const s = textStats('The the THE cat')
    expect(s.uniqueWords).toBe(2)
    expect(s.averageWordLength).toBe(3)
  })

  it('derives reading and speaking time from word count', () => {
    const s = textStats('word '.repeat(238))
    expect(s.readingTime).toBeCloseTo(60)
    expect(s.speakingTime).toBeCloseTo((238 / 130) * 60)
  })
})

describe('keywordDensity', () => {
  const text = 'The cat sat on the mat. The cat ran. A dog ran.'

  it('ranks single words with density over all words', () => {
    const k = keywordDensity(text, 1, false)
    expect(k[0]).toEqual({ phrase: 'the', count: 3, density: 3 / 12 })
    expect(k[1]).toMatchObject({ phrase: 'cat', count: 2 })
  })

  it('excludes English stop words', () => {
    const k = keywordDensity(text, 1, true)
    expect(k.map((x) => x.phrase)).not.toContain('the')
    expect(k[0]).toMatchObject({ phrase: 'cat', count: 2 })
  })

  it('builds phrases within sentences only', () => {
    const k = keywordDensity(text, 2, false)
    expect(k[0]).toMatchObject({ phrase: 'the cat', count: 2 })
    expect(k.map((x) => x.phrase)).not.toContain('mat the')
    expect(k.map((x) => x.phrase)).not.toContain('ran a')
  })

  it('drops phrases that start or end with a stop word but keeps inner ones', () => {
    const k = keywordDensity('State of the art. The state of art. State of art.', 3, true)
    expect(k.map((x) => x.phrase)).toEqual(['state of art'])
    expect(keywordDensity('Don’t stop me', 1, true).map((x) => x.phrase)).toEqual(['stop'])
  })
})

it('formats durations', () => {
  expect(formatDuration(0)).toBe('0 s')
  expect(formatDuration(44.6)).toBe('45 s')
  expect(formatDuration(190)).toBe('3 min 10 s')
  expect(formatDuration(3720)).toBe('1 h 2 min')
})
