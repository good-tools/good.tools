const upper = (s: string) => s.toLocaleUpperCase()
const lower = (s: string) => s.toLocaleLowerCase()
/** Uppercases the first code point, leaves the rest alone */
const capitalize = (s: string) => {
  const [head = '', ...tail] = s
  return upper(head) + tail.join('')
}

/**
 * Splits text into lowercase words for identifier cases. Understands existing
 * camelCase, PascalCase, snake_case, kebab-case, dot.case and acronyms
 * (`XMLHttpRequest` → xml, http, request). Apostrophes inside words are dropped.
 */
export function splitWords(text: string): string[] {
  return (
    text
      .replace(/(\p{L})['’](?=\p{L})/gu, '$1')
      // fooBar, base64Encode → foo Bar, base64 Encode
      .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2')
      // XMLHttp → XML Http
      .replace(/(\p{Lu})(?=\p{Lu}\p{Ll})/gu, '$1 ')
      .match(/[\p{L}\p{M}\p{N}]+/gu)
      ?.map(lower) ?? []
  )
}

/** Lowercase in titles unless first or last (Chicago-style short words) */
const SMALL = new Set('a an and as at but by en for if in nor of off on or per so the to up via vs v yet'.split(' '))

const WORD = /[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}]+)*/gu
/** Punctuation that starts a new phrase in a title */
const BREAK = /[:.!?;—–\n]|\s-\s/

export function titleCase(text: string): string {
  const words = [...text.matchAll(WORD)]
  let out = ''
  let pos = 0
  words.forEach((m, i) => {
    const start = m.index
    const end = start + m[0].length
    const before = text.slice(pos, start)
    const after = text.slice(end, words[i + 1]?.index ?? text.length)
    const w = m[0]
    // Keep deliberate mixed case such as iPhone or McDonald
    const mixed = /\p{Ll}/u.test(w) && /\p{Lu}/u.test(w.slice(1))
    // Hyphen parts are separate words; the first part is always capitalized ("up-to-date" → "Up-to-Date")
    const compoundStart = after.startsWith('-') && !before.endsWith('-')
    const edge = i === 0 || BREAK.test(before) || i === words.length - 1 || BREAK.test(after) || compoundStart
    const l = lower(w)
    out += before + (mixed ? w : !edge && SMALL.has(l) ? l : capitalize(l))
    pos = end
  })
  return out + text.slice(pos)
}

export function sentenceCase(text: string): string {
  return lower(text).replace(
    /(^|[.!?…]\s+|\n)([^\p{L}\p{N}\n]*?)(\p{L})/gu,
    (_, lead: string, punct: string, c: string) => lead + punct + upper(c),
  )
}

export function alternatingCase(text: string): string {
  let i = 0
  return [...text].map((c) => (upper(c) === lower(c) ? c : i++ % 2 ? upper(c) : lower(c))).join('')
}

export function inverseCase(text: string): string {
  return [...text].map((c) => (c === upper(c) ? lower(c) : upper(c))).join('')
}

const join =
  (sep: string, f: (w: string) => string = (w) => w) =>
  (text: string) =>
    splitWords(text).map(f).join(sep)

export const CASES = [
  { id: 'upper', label: 'UPPERCASE', convert: upper },
  { id: 'lower', label: 'lowercase', convert: lower },
  { id: 'title', label: 'Title Case', convert: titleCase },
  { id: 'sentence', label: 'Sentence case', convert: sentenceCase },
  {
    id: 'camel',
    label: 'camelCase',
    convert: (t: string) =>
      splitWords(t)
        .map((w, i) => (i ? capitalize(w) : w))
        .join(''),
  },
  { id: 'pascal', label: 'PascalCase', convert: join('', capitalize) },
  { id: 'snake', label: 'snake_case', convert: join('_') },
  { id: 'constant', label: 'CONSTANT_CASE', convert: join('_', upper) },
  { id: 'kebab', label: 'kebab-case', convert: join('-') },
  { id: 'dot', label: 'dot.case', convert: join('.') },
  { id: 'path', label: 'path/case', convert: join('/') },
  { id: 'alternating', label: 'aLtErNaTiNg', convert: alternatingCase },
  { id: 'inverse', label: 'iNVERSE', convert: inverseCase },
] as const

export type CaseId = (typeof CASES)[number]['id']

/** Converts `text`, optionally treating each line as its own input (for lists of names). */
export function convertCase(id: CaseId, text: string, perLine = false): string {
  const { convert } = CASES.find((c) => c.id === id)!
  return perLine ? text.split('\n').map(convert).join('\n') : convert(text)
}
