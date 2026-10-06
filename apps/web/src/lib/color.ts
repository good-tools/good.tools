/**
 * CSS color parsing and conversion (CSS Color 4 formulas). Colors are carried as
 * sRGB channels in 0..1 (unclamped, so lab()/oklch() outside sRGB survive a round trip).
 */
export interface Rgba {
  r: number
  g: number
  b: number
  alpha: number
}

type Vec3 = [number, number, number]

// CSS named colors (CSS Color 4), packed as name:hex
const NAMED = Object.fromEntries(
  'aliceblue:f0f8ff antiquewhite:faebd7 aqua:00ffff aquamarine:7fffd4 azure:f0ffff beige:f5f5dc bisque:ffe4c4 black:000000 blanchedalmond:ffebcd blue:0000ff blueviolet:8a2be2 brown:a52a2a burlywood:deb887 cadetblue:5f9ea0 chartreuse:7fff00 chocolate:d2691e coral:ff7f50 cornflowerblue:6495ed cornsilk:fff8dc crimson:dc143c cyan:00ffff darkblue:00008b darkcyan:008b8b darkgoldenrod:b8860b darkgray:a9a9a9 darkgreen:006400 darkgrey:a9a9a9 darkkhaki:bdb76b darkmagenta:8b008b darkolivegreen:556b2f darkorange:ff8c00 darkorchid:9932cc darkred:8b0000 darksalmon:e9967a darkseagreen:8fbc8f darkslateblue:483d8b darkslategray:2f4f4f darkslategrey:2f4f4f darkturquoise:00ced1 darkviolet:9400d3 deeppink:ff1493 deepskyblue:00bfff dimgray:696969 dimgrey:696969 dodgerblue:1e90ff firebrick:b22222 floralwhite:fffaf0 forestgreen:228b22 fuchsia:ff00ff gainsboro:dcdcdc ghostwhite:f8f8ff gold:ffd700 goldenrod:daa520 gray:808080 green:008000 greenyellow:adff2f grey:808080 honeydew:f0fff0 hotpink:ff69b4 indianred:cd5c5c indigo:4b0082 ivory:fffff0 khaki:f0e68c lavender:e6e6fa lavenderblush:fff0f5 lawngreen:7cfc00 lemonchiffon:fffacd lightblue:add8e6 lightcoral:f08080 lightcyan:e0ffff lightgoldenrodyellow:fafad2 lightgray:d3d3d3 lightgreen:90ee90 lightgrey:d3d3d3 lightpink:ffb6c1 lightsalmon:ffa07a lightseagreen:20b2aa lightskyblue:87cefa lightslategray:778899 lightslategrey:778899 lightsteelblue:b0c4de lightyellow:ffffe0 lime:00ff00 limegreen:32cd32 linen:faf0e6 magenta:ff00ff maroon:800000 mediumaquamarine:66cdaa mediumblue:0000cd mediumorchid:ba55d3 mediumpurple:9370db mediumseagreen:3cb371 mediumslateblue:7b68ee mediumspringgreen:00fa9a mediumturquoise:48d1cc mediumvioletred:c71585 midnightblue:191970 mintcream:f5fffa mistyrose:ffe4e1 moccasin:ffe4b5 navajowhite:ffdead navy:000080 oldlace:fdf5e6 olive:808000 olivedrab:6b8e23 orange:ffa500 orangered:ff4500 orchid:da70d6 palegoldenrod:eee8aa palegreen:98fb98 paleturquoise:afeeee palevioletred:db7093 papayawhip:ffefd5 peachpuff:ffdab9 peru:cd853f pink:ffc0cb plum:dda0dd powderblue:b0e0e6 purple:800080 rebeccapurple:663399 red:ff0000 rosybrown:bc8f8f royalblue:4169e1 saddlebrown:8b4513 salmon:fa8072 sandybrown:f4a460 seagreen:2e8b57 seashell:fff5ee sienna:a0522d silver:c0c0c0 skyblue:87ceeb slateblue:6a5acd slategray:708090 slategrey:708090 snow:fffafa springgreen:00ff7f steelblue:4682b4 tan:d2b48c teal:008080 thistle:d8bfd8 tomato:ff6347 turquoise:40e0d0 violet:ee82ee wheat:f5deb3 white:ffffff whitesmoke:f5f5f5 yellow:ffff00 yellowgreen:9acd32'
    .split(' ')
    .map((p) => p.split(':') as [string, string]),
)

const mul = (m: number[][], v: Vec3): Vec3 => m.map((row) => row[0]! * v[0] + row[1]! * v[1] + row[2]! * v[2]) as Vec3

const toLinear = (c: number) => {
  const a = Math.abs(c)
  return a <= 0.04045 ? c / 12.92 : Math.sign(c) * ((a + 0.055) / 1.055) ** 2.4
}
const fromLinear = (c: number) => {
  const a = Math.abs(c)
  return a <= 0.0031308 ? c * 12.92 : Math.sign(c) * (1.055 * a ** (1 / 2.4) - 0.055)
}

// Linear sRGB <-> OKLab (Björn Ottosson)
function linToOklab([r, g, b]: Vec3): Vec3 {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}
function oklabToLin([L, a, b]: Vec3): Vec3 {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

// CIE Lab (D50) via XYZ with Bradford adaptation, matrices from CSS Color 4
const LIN_TO_XYZ_D50 = [
  [0.4360747, 0.3850649, 0.1430804],
  [0.2225045, 0.7168786, 0.0606169],
  [0.0139322, 0.0971045, 0.7141733],
]
const XYZ_D50_TO_LIN = [
  [3.1338561, -1.6168667, -0.4906146],
  [-0.9787684, 1.9161415, 0.033454],
  [0.0719453, -0.2289914, 1.4052427],
]
const D50: Vec3 = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585]
const EPS = 216 / 24389
const KAPPA = 24389 / 27

function labToLin([L, a, b]: Vec3): Vec3 {
  const f1 = (L + 16) / 116
  const f0 = a / 500 + f1
  const f2 = f1 - b / 200
  const xyz: Vec3 = [
    f0 ** 3 > EPS ? f0 ** 3 : (116 * f0 - 16) / KAPPA,
    L > KAPPA * EPS ? f1 ** 3 : L / KAPPA,
    f2 ** 3 > EPS ? f2 ** 3 : (116 * f2 - 16) / KAPPA,
  ]
  return mul(XYZ_D50_TO_LIN, xyz.map((v, i) => v * D50[i]!) as Vec3)
}
function linToLab(rgb: Vec3): Vec3 {
  const f = mul(LIN_TO_XYZ_D50, rgb).map((v, i) => {
    const x = v / D50[i]!
    return x > EPS ? Math.cbrt(x) : (KAPPA * x + 16) / 116
  })
  return [116 * f[1]! - 16, 500 * (f[0]! - f[1]!), 200 * (f[1]! - f[2]!)]
}

const polar = (h: number, c: number): [number, number] => [
  c * Math.cos((h * Math.PI) / 180),
  c * Math.sin((h * Math.PI) / 180),
]
const toPolar = (a: number, b: number): [number, number] => {
  const c = Math.hypot(a, b)
  return [c, c < 1e-4 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360]
}

function hslToRgb(h: number, s: number, l: number): Vec3 {
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [f(0), f(8), f(4)]
}
function hwbToRgb(h: number, w: number, bl: number): Vec3 {
  if (w + bl >= 1) return [w / (w + bl), w / (w + bl), w / (w + bl)]
  return hslToRgb(h, 1, 0.5).map((c) => c * (1 - w - bl) + w) as Vec3
}

const HUE_UNITS: Record<string, number> = { '': 1, deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: 360 }

/** Parses one CSS component. `pct` is what 100% maps to; returns NaN on garbage. */
function num(token: string | undefined, pct: number, hue = false): number {
  if (token === undefined) return Number.NaN
  if (token === 'none') return 0
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|deg|grad|rad|turn)?$/.exec(token)
  if (!m) return Number.NaN
  const v = Number(m[1])
  const unit = m[2] ?? ''
  if (unit === '%') return (v / 100) * pct
  if (hue) return (((v * HUE_UNITS[unit]!) % 360) + 360) % 360
  return unit ? Number.NaN : v
}

function fromHex(hex: string): Rgba | undefined {
  if (!/^[0-9a-f]+$/.test(hex) || ![3, 4, 6, 8].includes(hex.length)) return undefined
  const h = hex.length <= 4 ? hex.replace(/./g, '$&$&') : hex
  const n = (i: number) => Number.parseInt(h.slice(i, i + 2), 16) / 255
  return { r: n(0), g: n(2), b: n(4), alpha: h.length === 8 ? n(6) : 1 }
}

/** Parses any CSS color string (hex, named, rgb, hsl, hwb, lab, lch, oklab, oklch). Throws on invalid input. */
export function parseColor(input: string): Rgba {
  const s = input.trim().toLowerCase()
  if (!s) throw new Error('Enter a color')
  if (s === 'transparent') return { r: 0, g: 0, b: 0, alpha: 0 }
  const named = NAMED[s]
  if (named) return fromHex(named)!
  const hex = fromHex(s.replace(/^#/, ''))
  if (hex) return hex
  const fn = /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\((.*)\)$/.exec(s)
  if (!fn) throw new Error(`Not a CSS color: "${input.trim()}"`)
  const name = fn[1]!.replace(/a$/, '')
  // Accept both legacy "a, b, c, alpha" and modern "a b c / alpha"
  const [main, slash, extra] = fn[2]!.split('/')
  if (extra !== undefined) throw new Error(`Invalid ${name}() value: "${input.trim()}"`)
  const parts = main!.trim().split(/\s*,\s*|\s+/)
  if (slash !== undefined) parts.push(slash.trim())
  if (parts.length < 3 || parts.length > 4) throw new Error(`${name}() needs 3 components plus an optional alpha`)
  const alpha = parts[3] === undefined ? 1 : num(parts[3], 1)
  const [p0, p1, p2] = parts
  let rgb: Vec3
  switch (name) {
    case 'rgb':
      rgb = [num(p0, 255) / 255, num(p1, 255) / 255, num(p2, 255) / 255]
      break
    case 'hsl':
      rgb = hslToRgb(num(p0, 0, true), num(p1, 100) / 100, num(p2, 100) / 100)
      break
    case 'hwb':
      rgb = hwbToRgb(num(p0, 0, true), num(p1, 100) / 100, num(p2, 100) / 100)
      break
    case 'lab':
      rgb = labToLin([num(p0, 100), num(p1, 125), num(p2, 125)]).map(fromLinear) as Vec3
      break
    case 'lch':
      rgb = labToLin([num(p0, 100), ...polar(num(p2, 0, true), num(p1, 150))]).map(fromLinear) as Vec3
      break
    case 'oklab':
      rgb = oklabToLin([num(p0, 1), num(p1, 0.4), num(p2, 0.4)]).map(fromLinear) as Vec3
      break
    default:
      rgb = oklabToLin([num(p0, 1), ...polar(num(p2, 0, true), num(p1, 0.4))]).map(fromLinear) as Vec3
  }
  if ([...rgb, alpha].some(Number.isNaN)) throw new Error(`Invalid ${name}() value: "${input.trim()}"`)
  return { r: rgb[0], g: rgb[1], b: rgb[2], alpha: Math.min(1, Math.max(0, alpha)) }
}

const clamp = (v: number) => Math.min(1, Math.max(0, v))
/** Rounds to `d` decimals and drops trailing zeros (and -0). */
const fmt = (v: number, d = 0) => String(Number(v.toFixed(d)) || 0)
const alphaPart = (a: number) => (a < 1 ? ` / ${fmt(a * 100, 1)}%` : '')

export const inGamut = ({ r, g, b }: Rgba) => [r, g, b].every((c) => c >= -1e-4 && c <= 1 + 1e-4)
export const clampRgb = (c: Rgba): Rgba => ({ r: clamp(c.r), g: clamp(c.g), b: clamp(c.b), alpha: c.alpha })

export function toHex(c: Rgba): string {
  const h = (v: number) =>
    Math.round(clamp(v) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${h(c.r)}${h(c.g)}${h(c.b)}${c.alpha < 1 ? h(c.alpha) : ''}`
}

export function toRgb(c: Rgba): string {
  const v = (x: number) => Math.round(clamp(x) * 255)
  return `rgb(${v(c.r)} ${v(c.g)} ${v(c.b)}${alphaPart(c.alpha)})`
}

function hsl({ r, g, b }: Rgba): Vec3 {
  ;[r, g, b] = [clamp(r), clamp(g), clamp(b)]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

export function toHsl(c: Rgba): string {
  const [h, s, l] = hsl(c)
  return `hsl(${fmt(h, 1)} ${fmt(s * 100, 1)}% ${fmt(l * 100, 1)}%${alphaPart(c.alpha)})`
}

export function toHwb(c: Rgba): string {
  const [h] = hsl(c)
  const w = Math.min(clamp(c.r), clamp(c.g), clamp(c.b))
  const bl = 1 - Math.max(clamp(c.r), clamp(c.g), clamp(c.b))
  return `hwb(${fmt(h, 1)} ${fmt(w * 100, 1)}% ${fmt(bl * 100, 1)}%${alphaPart(c.alpha)})`
}

export const oklab = (c: Rgba): Vec3 => linToOklab([toLinear(c.r), toLinear(c.g), toLinear(c.b)])
export const lab = (c: Rgba): Vec3 => linToLab([toLinear(c.r), toLinear(c.g), toLinear(c.b)])

export function toOklab(c: Rgba): string {
  const [L, a, b] = oklab(c)
  return `oklab(${fmt(L * 100, 2)}% ${fmt(a, 4)} ${fmt(b, 4)}${alphaPart(c.alpha)})`
}

export function toOklch(c: Rgba): string {
  const [L, a, b] = oklab(c)
  const [C, h] = toPolar(a, b)
  return `oklch(${fmt(L * 100, 2)}% ${fmt(C, 4)} ${fmt(h, 2)}${alphaPart(c.alpha)})`
}

export function toLab(c: Rgba): string {
  const [L, a, b] = lab(c)
  return `lab(${fmt(L, 2)}% ${fmt(a, 2)} ${fmt(b, 2)}${alphaPart(c.alpha)})`
}

/** Naive device CMYK (no ICC profile): what most design tools show as "CMYK". */
export function toCmyk(c: Rgba): string {
  const [r, g, b] = [clamp(c.r), clamp(c.g), clamp(c.b)]
  const k = 1 - Math.max(r, g, b)
  const p = (v: number) => `${fmt(k === 1 ? 0 : ((1 - v - k) / (1 - k)) * 100)}%`
  return `cmyk(${p(r)} ${p(g)} ${p(b)} ${fmt(k * 100)}%)`
}

/** `fg` alpha-composited over `bg` (bg is treated as opaque). */
export function over(fg: Rgba, bg: Rgba): Rgba {
  const mix = (f: number, b: number) => f * fg.alpha + b * (1 - fg.alpha)
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), alpha: 1 }
}

/** WCAG 2 relative luminance. */
export const luminance = (c: Rgba) => {
  const [r, g, b] = [c.r, c.g, c.b].map((v) => toLinear(clamp(v)))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

/** WCAG 2 contrast ratio (1–21) of `fg` on `bg`; a translucent fg is composited first. */
export function contrast(fg: Rgba, bg: Rgba): number {
  const solidBg = over(bg, { r: 1, g: 1, b: 1, alpha: 1 })
  const [a, b] = [luminance(over(fg, solidBg)), luminance(solidBg)]
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** `steps` tints (towards white), the color, then `steps` shades (towards black), interpolated in OKLab. */
export function tintsAndShades(c: Rgba, steps = 5): Rgba[] {
  const base = oklab(c)
  const mixTo = (target: Vec3, t: number): Rgba => {
    const [r, g, b] = oklabToLin(base.map((v, i) => v + (target[i]! - v) * t) as Vec3).map(fromLinear)
    return clampRgb({ r: r!, g: g!, b: b!, alpha: 1 })
  }
  const solid = { ...c, alpha: 1 }
  return [
    ...Array.from({ length: steps }, (_, i) => mixTo([1, 0, 0], (steps - i) / (steps + 1))),
    solid,
    ...Array.from({ length: steps }, (_, i) => mixTo([0, 0, 0], (i + 1) / (steps + 1))),
  ]
}
