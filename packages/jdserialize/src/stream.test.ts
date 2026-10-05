import { Buffer } from 'node:buffer'
import { deserialize, normalize, print } from '.'

// Minimal hand-built Java serialization streams (java.io.ObjectOutputStream format)
const MAGIC = [0xac, 0xed, 0x00, 0x05]
const TC_OBJECT = 0x73
const TC_CLASSDESC = 0x72
const TC_ENDBLOCKDATA = 0x78
const TC_NULL = 0x70
const TC_RESET = 0x79
const SC_SERIALIZABLE = 0x02

const utf = (s: string) => [0, s.length, ...Buffer.from(s)]

/** An object of class `name` with primitive fields; `annotations` are raw content bytes before TC_ENDBLOCKDATA. */
function object(name: string, fields: [type: string, name: string, bytes: number[]][], annotations: number[] = []) {
  return [
    TC_OBJECT,
    TC_CLASSDESC,
    ...utf(name),
    ...[0, 0, 0, 0, 0, 0, 0, 1], // serialVersionUID
    SC_SERIALIZABLE,
    0,
    fields.length,
    ...fields.flatMap(([type, field]) => [type.charCodeAt(0), ...utf(field)]),
    ...annotations,
    TC_ENDBLOCKDATA,
    TC_NULL, // no superclass
    ...fields.flatMap(([, , bytes]) => bytes),
  ]
}

const negatives = object('T', [
  ['B', 'b', [0xff]],
  ['I', 'i', [0xff, 0xff, 0xff, 0xff]],
  ['S', 's', [0xff, 0xfe]],
  ['C', 'c', [0x00, 0x41]],
])

test('byte, short and int fields are signed; char is not', () => {
  const [obj] = normalize(deserialize(Buffer.from([...MAGIC, ...negatives])).objects) as Record<string, unknown>[]
  expect(obj).toEqual({ b: -1, i: -1, s: -2, c: 'A' })
})

test('TC_RESET between top-level objects is handled', () => {
  const stream = Buffer.from([...MAGIC, ...negatives, TC_RESET, ...object('U', [['I', 'x', [0, 0, 0, 7]]])])
  const { objects, classes } = deserialize(stream)
  expect(normalize(objects)).toEqual([{ b: -1, i: -1, s: -2, c: 'A' }, { x: 7 }])
  expect(classes.map((c) => c.name)).toEqual(['T', 'U'])
})

test('field names like __proto__ become own properties', () => {
  const [obj] = normalize(
    deserialize(Buffer.from([...MAGIC, ...object('P', [['I', '__proto__', [0, 0, 0, 1]]])])).objects,
  ) as object[]
  expect(Object.keys(obj)).toEqual(['__proto__'])
  expect(JSON.stringify(obj)).toBe('{"__proto__":1}')
})

test('class dump tolerates null class annotations', () => {
  const { classes } = deserialize(Buffer.from([...MAGIC, ...object('A', [], [TC_NULL])]))
  expect(() => print(classes)).not.toThrow()
  expect(print(classes)).toContain('null')
})
