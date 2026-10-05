import { describe, expect, it } from 'vitest'
import {
  AMBIGUOUS,
  generatePassphrase,
  generatePassword,
  passphraseEntropy,
  passwordEntropy,
  randomInt,
  WORDS,
} from './password'

describe('randomInt', () => {
  it('rejects draws from the incomplete top range instead of wrapping them', () => {
    // n = 3: 2^32 % 3 = 1, so 2^32 - 1 is the one rejected value
    const draws = [2 ** 32 - 1, 2 ** 32 - 2, 5]
    let calls = 0
    const value = randomInt(3, () => draws[calls++]!)
    expect(calls).toBe(2)
    expect(value).toBe((2 ** 32 - 2) % 3)
  })

  it('is unbiased for a range that does not divide 2^32', () => {
    const n = 6
    const counts = new Array(n).fill(0)
    const samples = 60_000
    for (let i = 0; i < samples; i++) counts[randomInt(n)]++
    // Chi-square, 5 degrees of freedom: 35 is beyond the p = 1e-6 critical value (~1 flake per million runs)
    const expected = samples / n
    const chi2 = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0)
    expect(chi2).toBeLessThan(35)
  })

  it('rejects bad ranges', () => {
    expect(() => randomInt(0)).toThrow(RangeError)
    expect(() => randomInt(1.5)).toThrow(RangeError)
  })
})

describe('generatePassword', () => {
  it('uses only the chosen sets and includes each of them', () => {
    for (let i = 0; i < 200; i++) {
      const pw = generatePassword({ length: 8, sets: ['lower', 'digits'], excludeAmbiguous: false })
      expect(pw).toMatch(/^[a-z0-9]{8}$/)
      expect(pw).toMatch(/[a-z]/)
      expect(pw).toMatch(/[0-9]/)
    }
  })

  it('can leave out ambiguous characters', () => {
    const pw = generatePassword({ length: 2000, sets: ['lower', 'upper', 'digits', 'symbols'], excludeAmbiguous: true })
    expect([...pw].filter((c) => AMBIGUOUS.includes(c))).toEqual([])
  })

  it('estimates entropy from the pool size', () => {
    expect(passwordEntropy({ length: 10, sets: ['digits'], excludeAmbiguous: false })).toBeCloseTo(33.22, 2)
    expect(passwordEntropy({ length: 10, sets: ['digits'], excludeAmbiguous: true })).toBeCloseTo(30, 2) // 8 digits
  })
})

describe('generatePassphrase', () => {
  it('joins words from the EFF short list', () => {
    expect(WORDS).toHaveLength(1296)
    const words = generatePassphrase({ words: 5, separator: '-', capitalize: true }).split('-')
    expect(words).toHaveLength(5)
    for (const w of words) expect(WORDS).toContain(w[0]!.toLowerCase() + w.slice(1))
  })

  it('has log2(1296) ≈ 10.34 bits per word', () => {
    expect(passphraseEntropy({ words: 6, separator: ' ', capitalize: false })).toBeCloseTo(62.04, 2)
  })
})
