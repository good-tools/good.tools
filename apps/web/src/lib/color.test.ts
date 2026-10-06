import { describe, expect, it } from 'vitest'
import {
  contrast,
  inGamut,
  lab,
  oklab,
  parseColor,
  tintsAndShades,
  toCmyk,
  toHex,
  toHsl,
  toHwb,
  toOklab,
  toOklch,
  toRgb,
} from './color'

const hex = (s: string) => toHex(parseColor(s))

describe('parseColor', () => {
  it.each([
    ['#f00', '#ff0000'],
    ['#ff000080', '#ff000080'],
    ['#F008', '#ff000088'],
    ['3B82F6', '#3b82f6'],
    ['red', '#ff0000'],
    ['RebeccaPurple', '#663399'],
    ['transparent', '#00000000'],
    ['rgb(255, 0, 0)', '#ff0000'],
    ['rgba(255,0,0,0.5)', '#ff000080'],
    ['rgb(100% 0% 0% / 50%)', '#ff000080'],
    ['hsl(210, 100%, 50%)', '#0080ff'],
    ['hsl(0.5turn 100% 25%)', '#008080'],
    ['hsl(270 50% 40%)', '#663399'],
    ['hwb(0 0% 0%)', '#ff0000'],
    ['hwb(120 20% 30%)', '#33b333'],
    ['hwb(0 60% 60%)', '#808080'],
    ['oklch(62.8% 0.2577 29.23)', '#ff0000'],
    ['oklch(0.628 0.2577 29.23)', '#ff0000'],
    ['oklab(0.628 0.2249 0.1258)', '#ff0000'],
    ['lab(54.29 80.8 69.89)', '#ff0000'],
    ['lch(54.29% 106.84 40.85)', '#ff0000'],
    ['oklch(1 0 none)', '#ffffff'],
  ])('%s -> %s', (input, expected) => expect(hex(input)).toBe(expected))

  it('rejects invalid input', () => {
    for (const s of ['', 'notacolor', '#12345', 'rgb(1 2)', 'rgb(a b c)', 'hsl(10 20% 30% / 1 / 2)', 'rgb(1px 2 3)'])
      expect(() => parseColor(s)).toThrow()
  })
})

describe('conversions', () => {
  const red = parseColor('#ff0000')
  it('formats red in every space', () => {
    expect(toRgb(red)).toBe('rgb(255 0 0)')
    expect(toHsl(red)).toBe('hsl(0 100% 50%)')
    expect(toHwb(red)).toBe('hwb(0 0% 0%)')
    expect(toOklch(red)).toBe('oklch(62.8% 0.2577 29.23)')
    expect(toOklab(red)).toBe('oklab(62.8% 0.2249 0.1258)')
    expect(toCmyk(red)).toBe('cmyk(0% 100% 100% 0%)')
    const [L, a, b] = lab(red)
    expect(L).toBeCloseTo(54.29, 1)
    expect(a).toBeCloseTo(80.8, 0)
    expect(b).toBeCloseTo(69.89, 0)
  })

  it('handles greys, alpha and black', () => {
    expect(toHsl(parseColor('#808080'))).toBe('hsl(0 0% 50.2%)')
    expect(toOklch(parseColor('white'))).toBe('oklch(100% 0 0)')
    expect(oklab(parseColor('black'))).toEqual([0, 0, 0])
    expect(toRgb(parseColor('#ff000080'))).toBe('rgb(255 0 0 / 50.2%)')
    expect(toCmyk(parseColor('black'))).toBe('cmyk(0% 0% 0% 100%)')
    expect(toCmyk(parseColor('#336699'))).toBe('cmyk(67% 33% 0% 40%)')
  })

  it('round-trips through every output format', () => {
    for (const s of ['#3b82f6', '#663399', '#10b981', '#fafafa', '#123456'])
      for (const f of [toRgb, toHsl, toHwb, toOklch, toOklab]) expect(hex(f(parseColor(s)))).toBe(s)
  })

  it('flags colors outside sRGB', () => {
    expect(inGamut(parseColor('oklch(0.7 0.3 150)'))).toBe(false)
    expect(inGamut(parseColor('oklch(0.7 0.1 150)'))).toBe(true)
    expect(toOklch(parseColor('oklch(70% 0.3 150)'))).toBe('oklch(70% 0.3 150)')
  })
})

describe('contrast', () => {
  it('matches WCAG reference values', () => {
    expect(contrast(parseColor('black'), parseColor('white'))).toBeCloseTo(21, 5)
    expect(contrast(parseColor('white'), parseColor('white'))).toBe(1)
    expect(contrast(parseColor('#777'), parseColor('#fff'))).toBeCloseTo(4.48, 2)
    expect(contrast(parseColor('#fff'), parseColor('#777'))).toBeCloseTo(4.48, 2)
    // translucent black on white composites to mid grey
    expect(contrast(parseColor('rgb(0 0 0 / 50%)'), parseColor('white'))).toBeCloseTo(
      contrast(parseColor('#808080'), parseColor('white')),
      1,
    )
  })
})

describe('tintsAndShades', () => {
  it('runs from light to dark around the color', () => {
    const strip = tintsAndShades(parseColor('#3b82f6'))
    expect(strip).toHaveLength(11)
    expect(toHex(strip[5]!)).toBe('#3b82f6')
    const L = strip.map((c) => oklab(c)[0])
    for (let i = 1; i < L.length; i++) expect(L[i]!).toBeLessThan(L[i - 1]!)
  })
})
