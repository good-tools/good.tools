import { Buffer } from 'node:buffer'
import { decode, possibleValues } from '.'

const varint = (n: bigint) => {
  const out: number[] = []
  do {
    let byte = Number(n & 0x7fn)
    n >>= 7n
    if (n > 0n) byte |= 0x80
    out.push(byte)
  } while (n > 0n)
  return out
}

test('field numbers up to 2^29-1 decode correctly', () => {
  const field = 2 ** 29 - 1
  const [part] = decode(Buffer.from([...varint((BigInt(field) << 3n) | 0n), 0x01])).fields
  expect(part?.field).toBe(field)
  expect(part?.value).toBe(1n)
})

test('fixed64 is unsigned and sfixed64 signed', () => {
  const [part] = decode(Buffer.from([0x09, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])).fields
  const values = Object.fromEntries(possibleValues(part!).map((v) => [v.type, v.value]))
  expect(values.fixed64).toBe(2n ** 64n - 1n)
  expect(values.sfixed64).toBe(-1n)
})
