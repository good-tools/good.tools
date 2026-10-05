/** Symbologies the generator offers; the ids are bwip-js encoder names (QR is drawn by `qrcode`). */
export type Symbology =
  | 'qrcode'
  | 'code128'
  | 'ean13'
  | 'ean8'
  | 'upca'
  | 'code39'
  | 'itf14'
  | 'datamatrix'
  | 'pdf417'
  | 'azteccode'

/** [id, label, example input] */
export const SYMBOLOGIES: [Symbology, string, string][] = [
  ['qrcode', 'QR Code', 'https://good.tools'],
  ['code128', 'Code 128', 'GOOD-TOOLS-128'],
  ['ean13', 'EAN-13', '590123412345'],
  ['ean8', 'EAN-8', '9638507'],
  ['upca', 'UPC-A', '03600029145'],
  ['code39', 'Code 39', 'GOOD-TOOLS'],
  ['itf14', 'ITF-14', '1540014128876'],
  ['datamatrix', 'DataMatrix', 'https://good.tools'],
  ['pdf417', 'PDF417', 'https://good.tools'],
  ['azteccode', 'Aztec', 'https://good.tools'],
]

export const isLinear = (s: Symbology) => ['code128', 'ean13', 'ean8', 'upca', 'code39', 'itf14'].includes(s)

/** Full length (with check digit) of the GS1 numeric symbologies. */
const GTIN_LENGTH: Partial<Record<Symbology, number>> = { ean13: 13, ean8: 8, upca: 12, itf14: 14 }

/** GS1 mod-10 check digit: weights 3,1,3,… from the rightmost data digit. */
export function gs1CheckDigit(digits: string): number {
  let sum = 0
  for (let i = 0; i < digits.length; i++) sum += Number(digits[digits.length - 1 - i]) * (i % 2 ? 1 : 3)
  return (10 - (sum % 10)) % 10
}

/**
 * Validates `text` for symbology `s` and returns what to encode: EAN/UPC/ITF-14 get their check digit
 * appended when it is left out. Throws an Error with a readable message on invalid input.
 */
export function barcodeText(s: Symbology, text: string): string {
  const label = SYMBOLOGIES.find(([id]) => id === s)?.[1]
  const n = GTIN_LENGTH[s]
  if (n) {
    if (!/^\d+$/.test(text)) throw new Error(`${label} takes digits only`)
    if (text.length === n - 1) return text + gs1CheckDigit(text)
    if (text.length !== n) throw new Error(`${label} needs ${n - 1} digits, or ${n} with the check digit`)
    const check = gs1CheckDigit(text.slice(0, -1))
    if (Number(text.at(-1)) !== check)
      throw new Error(`Wrong check digit: ${label} ${text.slice(0, -1)} ends in ${check}`)
    return text
  }
  if (s === 'code39' && !/^[0-9A-Z .$/+%-]*$/.test(text))
    throw new Error('Code 39 supports only A–Z, 0–9, space and - . $ / + %')
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Code 128 encodes the whole ASCII range
  if (s === 'code128' && !/^[\x00-\x7f]*$/.test(text)) throw new Error('Code 128 supports ASCII characters only')
  return text
}
