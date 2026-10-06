/** The classic opening, used when "Start with Lorem ipsum" is on */
export const LOREM_START = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit'

// The standard word list from Cicero's De finibus, as used by most lorem ipsum generators
const WORDS = (
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore ' +
  'magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo ' +
  'consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint ' +
  'occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum ac accumsan aliquet ' +
  'ante arcu at auctor augue bibendum blandit condimentum congue cras curabitur cursus dapibus diam dictum ' +
  'dignissim donec egestas eget eleifend elementum eros etiam eu euismod facilisis faucibus felis fermentum ' +
  'feugiat fringilla fusce gravida hendrerit iaculis imperdiet integer interdum justo lacinia lacus laoreet ' +
  'lectus leo libero ligula lobortis luctus maecenas massa mattis mauris metus mi molestie morbi nam nec neque ' +
  'nibh nisl nunc odio orci ornare pellentesque pharetra phasellus placerat porta porttitor posuere praesent ' +
  'pretium proin pulvinar purus quam quisque rhoncus risus rutrum sagittis sapien scelerisque semper sodales ' +
  'sollicitudin suscipit suspendisse tellus tincidunt tortor tristique turpis ultrices ultricies urna varius ' +
  'vehicula vel venenatis vestibulum vitae vivamus viverra volutpat vulputate'
).split(' ')

export type Unit = 'paragraphs' | 'sentences' | 'words'
export type Format = 'text' | 'html' | 'markdown'

export const MAX: Record<Unit, number> = { paragraphs: 200, sentences: 2000, words: 20000 }

const between = (min: number, max: number, random: () => number) => min + Math.floor(random() * (max - min + 1))
const capitalize = (s: string) => s[0]!.toUpperCase() + s.slice(1)

/** n random words, no immediate repeats */
function words(n: number, random: () => number): string[] {
  const out: string[] = []
  while (out.length < n) {
    const w = WORDS[Math.floor(random() * WORDS.length)]!
    if (w !== out.at(-1)) out.push(w)
  }
  return out
}

/** A sentence of `ws` words, capitalized, with an occasional comma, ending in a period */
function sentence(ws: string[], random: () => number): string {
  if (ws.length > 7 && random() < 0.5) {
    const at = between(3, ws.length - 4, random)
    ws[at] = `${ws[at]},`
  }
  return `${capitalize(ws.join(' '))}.`
}

const sentences = (n: number, random: () => number) =>
  Array.from({ length: n }, () => sentence(words(between(6, 14, random), random), random))

/**
 * Generates lorem ipsum as a list of paragraphs. Words and sentences come back
 * as a single paragraph; counts are exact and clamped to 1..MAX[unit].
 */
export function lorem(unit: Unit, count: number, startWithLorem: boolean, random = Math.random): string[] {
  const n = Math.min(MAX[unit], Math.max(1, Math.floor(count) || 1))
  const start = LOREM_START.split(' ')
  if (unit === 'words') {
    const ws = startWithLorem
      ? [...start.slice(0, n), ...words(Math.max(0, n - start.length), random)]
      : words(n, random)
    return [`${capitalize(ws.join(' ').replace(/,$/, ''))}.`]
  }
  if (unit === 'sentences') {
    const ss = sentences(n, random)
    if (startWithLorem) ss[0] = `${LOREM_START}.`
    return [ss.join(' ')]
  }
  return Array.from({ length: n }, (_, i) => {
    const ss = sentences(between(4, 8, random), random)
    if (startWithLorem && i === 0) ss[0] = `${LOREM_START}.`
    return ss.join(' ')
  })
}

/** Plain text puts one paragraph per line; markdown separates them with a blank line */
export function formatLorem(paragraphs: string[], format: Format): string {
  if (format === 'html') return paragraphs.map((p) => `<p>${p}</p>`).join('\n')
  return paragraphs.join(format === 'markdown' ? '\n\n' : '\n')
}

/** Word count of generated text, for the panel title */
export const countWords = (paragraphs: string[]) => paragraphs.reduce((n, p) => n + p.split(' ').length, 0)
