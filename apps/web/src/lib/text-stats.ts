/** Average adult silent reading and speaking speeds, in words per minute. */
export const READING_WPM = 238
export const SPEAKING_WPM = 130

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
const wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' })
const sentenceSegmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' })

export interface TextStats {
  words: number
  characters: number
  charactersNoSpaces: number
  sentences: number
  paragraphs: number
  lines: number
  uniqueWords: number
  /** Mean word length in characters (graphemes) */
  averageWordLength: number
  /** Seconds */
  readingTime: number
  /** Seconds */
  speakingTime: number
}

/** Words per sentence, lowercased. Unicode-aware: CJK is split into dictionary words, emoji and punctuation are not words. */
export function sentenceWords(text: string): string[][] {
  const out: string[][] = []
  for (const { segment } of sentenceSegmenter.segment(text)) {
    const words: string[] = []
    for (const w of wordSegmenter.segment(segment)) if (w.isWordLike) words.push(w.segment.toLocaleLowerCase())
    if (words.length) out.push(words)
  }
  return out
}

const graphemeCount = (s: string) => {
  let n = 0
  for (const _ of graphemes.segment(s)) n++
  return n
}

/** Pass `sentences` from `sentenceWords(text)` if you already have them. */
export function textStats(text: string, sentences = sentenceWords(text)): TextStats {
  const words = sentences.flat()
  let characters = 0
  let spaces = 0
  for (const { segment } of graphemes.segment(text)) {
    characters++
    if (!segment.trim()) spaces++
  }
  return {
    words: words.length,
    characters,
    charactersNoSpaces: characters - spaces,
    sentences: sentences.length,
    paragraphs: text.split(/\n\s*\n/).filter((p) => p.trim()).length,
    lines: text ? text.split(/\r\n|\r|\n/).length : 0,
    uniqueWords: new Set(words).size,
    averageWordLength: words.length ? graphemeCount(words.join('')) / words.length : 0,
    readingTime: (words.length / READING_WPM) * 60,
    speakingTime: (words.length / SPEAKING_WPM) * 60,
  }
}

// biome-ignore format: one long list reads better than one word per line
export const STOP_WORDS = new Set('a about above after again against all am an and any are aren\'t as at be because been before being below between both but by can can\'t cannot could couldn\'t did didn\'t do does doesn\'t doing don\'t down during each few for from further had hadn\'t has hasn\'t have haven\'t having he he\'d he\'ll he\'s her here here\'s hers herself him himself his how how\'s i i\'d i\'ll i\'m i\'ve if in into is isn\'t it it\'s its itself let\'s me more most mustn\'t my myself no nor not of off on once only or other ought our ours ourselves out over own same shan\'t she she\'d she\'ll she\'s should shouldn\'t so some such than that that\'s the their theirs them themselves then there there\'s these they they\'d they\'ll they\'re they\'ve this those through to too under until up very was wasn\'t we we\'d we\'ll we\'re we\'ve were weren\'t what what\'s when when\'s where where\'s which while who who\'s whom why why\'s will with won\'t would wouldn\'t you you\'d you\'ll you\'re you\'ve your yours yourself yourselves'.split(' '))

export interface Keyword {
  phrase: string
  count: number
  /** Share of all n-word phrases, 0–1 */
  density: number
}

/**
 * Most frequent `n`-word phrases in `sentenceWords(text)`, never spanning a sentence boundary. With `excludeStopWords`, drops phrases that
 * start or end with an English stop word (so "the cat" goes but "state of the art" stays).
 */
export function keywordDensity(sentences: string[][], n: 1 | 2 | 3, excludeStopWords: boolean, limit = 50): Keyword[] {
  const counts = new Map<string, number>()
  let total = 0
  const stop = (w: string) => STOP_WORDS.has(w.replace(/[’‘]/g, "'"))
  for (const words of sentences) {
    for (let i = 0; i + n <= words.length; i++) {
      total++
      const phrase = words.slice(i, i + n)
      if (excludeStopWords && (stop(phrase[0]!) || stop(phrase[n - 1]!))) continue
      const key = phrase.join(' ')
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([phrase, count]) => ({ phrase, count, density: count / total }))
}

/** 0 s, 45 s, 3 min 10 s, 1 h 2 min */
export function formatDuration(seconds: number): string {
  const s = Math.round(seconds)
  if (s < 60) return `${s} s`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h ? `${h} h ${m} min` : `${m} min ${s % 60} s`
}
