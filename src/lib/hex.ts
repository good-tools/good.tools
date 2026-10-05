import { Buffer } from 'buffer'

/**
 * Parses user-entered hex (whitespace and `0x` prefixes allowed) into bytes.
 * Throws a descriptive Error instead of silently truncating like Buffer.from(s, 'hex').
 */
export function parseHex(input: string): Buffer {
  const hex = input.replace(/\s+/g, '').replace(/0x/gi, '')
  const bad = hex.search(/[^0-9a-f]/i)
  if (bad >= 0) throw new Error(`Invalid hex character "${hex[bad]}" at position ${bad + 1}`)
  if (hex.length % 2) throw new Error(`Hex input has an odd number of digits (${hex.length})`)
  return Buffer.from(hex, 'hex')
}
