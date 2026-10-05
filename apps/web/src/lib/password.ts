// EFF short wordlist #1 (1,296 words) by the Electronic Frontier Foundation, CC BY 3.0 US:
// https://www.eff.org/dice
import wordlist from './eff-short-wordlist.txt?raw'

export const WORDS = wordlist.trim().split('\n')

export const CHARSETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~',
}
export type Charset = keyof typeof CHARSETS
export const AMBIGUOUS = 'Il1|O0o`\'"'

const u32 = () => crypto.getRandomValues(new Uint32Array(1))[0]!

/**
 * Uniform integer in [0, n). Plain `random % n` favours small values whenever 2^32 isn't a multiple of n,
 * so draws from the incomplete top range are rejected and redrawn.
 */
export function randomInt(n: number, random: () => number = u32): number {
  if (!Number.isInteger(n) || n < 1 || n > 2 ** 32) throw new RangeError(`randomInt: bad range ${n}`)
  const limit = 2 ** 32 - (2 ** 32 % n)
  for (;;) {
    const r = random()
    if (r < limit) return r % n
  }
}

const pick = <T>(items: ArrayLike<T>) => items[randomInt(items.length)]!

export interface PasswordOptions {
  length: number
  sets: Charset[]
  excludeAmbiguous: boolean
}

const pools = ({ sets, excludeAmbiguous }: PasswordOptions) =>
  sets.map((s) => [...CHARSETS[s]].filter((c) => !excludeAmbiguous || !AMBIGUOUS.includes(c)).join(''))

/** Random password using at least one character from every chosen set (when the length allows it). */
export function generatePassword(opts: PasswordOptions): string {
  const sets = pools(opts)
  const all = sets.join('')
  if (!all) return ''
  for (;;) {
    const pw = Array.from({ length: opts.length }, () => pick(all)).join('')
    // Redrawing (instead of forcing a character in) keeps every valid password equally likely
    if (opts.length < sets.length || sets.every((set) => [...pw].some((c) => set.includes(c)))) return pw
  }
}

export const passwordEntropy = (opts: PasswordOptions) => opts.length * Math.log2(pools(opts).join('').length || 1)

export interface PassphraseOptions {
  words: number
  separator: string
  capitalize: boolean
}

export function generatePassphrase({ words, separator, capitalize }: PassphraseOptions): string {
  return Array.from({ length: words }, () => {
    const w = pick(WORDS)
    return capitalize ? w[0]!.toUpperCase() + w.slice(1) : w
  }).join(separator)
}

export const passphraseEntropy = ({ words }: PassphraseOptions) => words * Math.log2(WORDS.length)
