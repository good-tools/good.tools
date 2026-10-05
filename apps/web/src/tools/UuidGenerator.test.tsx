import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearToolState } from '@/hooks/useToolState'
import UuidGenerator, { decode, generate, nanoid, ulid, uuidv7 } from './UuidGenerator'

beforeEach(clearToolState)

const ms = Date.UTC(2022, 1, 22, 19, 22, 22)
const row = (rows: [string, string][], label: string) => rows.find(([l]) => l === label)?.[1]

describe('generators', () => {
  it('makes well-formed, unique ids', () => {
    for (const id of generate('v4', 50))
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    for (const id of generate('v7', 50))
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    for (const id of generate('ulid', 50)) expect(id).toMatch(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/)
    for (const id of generate('nanoid', 50)) expect(id).toMatch(/^[\w-]{21}$/)
    expect(new Set(generate('nanoid', 100)).size).toBe(100)
  })

  it('embeds the timestamp in v7 and ULID', () => {
    expect(uuidv7(ms).slice(0, 13)).toBe('017f22e2-79b0')
    expect(row(decode(uuidv7(ms)), 'Timestamp')).toBe('2022-02-22T19:22:22.000Z')
    expect(ulid(1469918176385).slice(0, 10)).toBe('01ARYZ6S41')
    expect(row(decode(ulid(ms)), 'Unix ms')).toBe(String(ms))
    expect(nanoid()).toHaveLength(21)
  })
})

describe('decode', () => {
  // Test vectors from RFC 9562, appendix A
  it.each([
    ['C232AB00-9414-11EC-B3C8-9F6BDECED846', '1 · Gregorian time + node'],
    ['1EC9414C-232A-6B00-B3C8-9F6BDECED846', '6 · Reordered Gregorian time'],
    ['017F22E2-79B0-7CC3-98C4-DC0C0C07398F', '7 · Unix time + random'],
  ])('reads the timestamp of %s', (id, version) => {
    const rows = decode(id)
    expect(row(rows, 'Version')).toBe(version)
    expect(row(rows, 'Variant')).toBe('RFC 9562 / RFC 4122')
    expect(row(rows, 'Timestamp')).toBe('2022-02-22T19:22:22.000Z')
  })

  it('shows clock sequence and node for v1', () => {
    const rows = decode('C232AB00-9414-11EC-B3C8-9F6BDECED846')
    expect(row(rows, 'Clock sequence')).toBe(String(0x33c8))
    expect(row(rows, 'Node')).toBe('9f:6b:de:ce:d8:46')
  })

  it('handles v4, braces, URNs, nil, max and other variants', () => {
    expect(decode('{919108f7-52d1-4320-9bac-f847db4148a8}')).toEqual([
      ['Type', 'UUID'],
      ['Canonical', '919108f7-52d1-4320-9bac-f847db4148a8'],
      ['Variant', 'RFC 9562 / RFC 4122'],
      ['Version', '4 · Random'],
    ])
    expect(row(decode('urn:uuid:919108f7-52d1-4320-9bac-f847db4148a8'), 'Version')).toBe('4 · Random')
    expect(decode('00000000-0000-0000-0000-000000000000')).toEqual([['Type', 'Nil UUID']])
    expect(decode('ffffffff-ffff-ffff-ffff-ffffffffffff')).toEqual([['Type', 'Max UUID']])
    expect(row(decode('919108f7-52d1-4320-cbac-f847db4148a8'), 'Variant')).toBe('Microsoft (reserved)')
  })

  it('decodes ULIDs case-insensitively', () => {
    expect(row(decode('01aryz6s41tsv4rrffq69g5fav'), 'Timestamp')).toBe('2016-07-30T22:36:16.385Z')
  })

  it('rejects anything else', () => {
    expect(() => decode('not-a-uuid')).toThrow(/Not a UUID/)
    expect(() => decode('919108f7-52d1-4320-9bac-f847db4148a')).toThrow()
  })
})

describe('UuidGenerator', () => {
  it('generates the requested number of ids and decodes', async () => {
    render(<UuidGenerator />)
    await userEvent.click(screen.getByRole('radio', { name: 'ULID' }))
    await userEvent.clear(screen.getByLabelText('Count'))
    await userEvent.type(screen.getByLabelText('Count'), '3')
    expect((screen.getByLabelText('Generated IDs') as HTMLTextAreaElement).value.split('\n')).toHaveLength(3)
    await userEvent.click(screen.getByRole('radio', { name: 'Decode' }))
    await userEvent.type(screen.getByLabelText('UUID or ULID to decode'), '017F22E2-79B0-7CC3-98C4-DC0C0C07398F')
    expect(screen.getByText('2022-02-22T19:22:22.000Z')).toBeInTheDocument()
  })
})
