import { initialValues, type JsonSchema, toArguments } from './SchemaForm'

const schema: JsonSchema = {
  type: 'object',
  properties: {
    query: { type: 'string' },
    limit: { type: 'integer', default: 10 },
    ratio: { type: 'number' },
    deep: { type: 'boolean' },
    mode: { enum: ['fast', 'slow'] },
    level: { enum: [1, 2] },
    tags: { type: 'array', items: { type: 'string' } },
  },
  required: ['query'],
}

test('defaults become initial values', () => {
  expect(initialValues(schema)).toMatchObject({ query: '', limit: '10', deep: false })
})

test('converts typed values and omits empty optionals', () => {
  const args = toArguments(schema, {
    query: 'mcp',
    limit: '5',
    ratio: '',
    deep: true,
    mode: 'fast',
    level: '2',
    tags: '["a","b"]',
  })
  expect(args).toEqual({ query: 'mcp', limit: 5, deep: true, mode: 'fast', level: 2, tags: ['a', 'b'] })
})

test('explains bad input', () => {
  expect(() => toArguments(schema, { query: '' })).toThrow('"query" is required')
  expect(() => toArguments(schema, { query: 'x', limit: '1.5' })).toThrow('"limit" must be an integer')
  expect(() => toArguments(schema, { query: 'x', tags: '[oops' })).toThrow('"tags" must be valid JSON')
})
