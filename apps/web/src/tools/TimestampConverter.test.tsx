import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearToolState } from '@/hooks/useToolState'
import TimestampConverter, { detectUnit, offsetMinutes, parseTimestamp, relative, zoned } from './TimestampConverter'

beforeEach(clearToolState)

describe('parseTimestamp', () => {
  it.each([
    ['1700000000', 's', 1_700_000_000_000_000_000n],
    ['1700000000123', 'ms', 1_700_000_000_123_000_000n],
    ['1700000000123456', 'us', 1_700_000_000_123_456_000n],
    ['1700000000123456789', 'ns', 1_700_000_000_123_456_789n],
    ['0', 's', 0n],
  ] as const)('auto-detects %s as %s, keeping full precision', (input, unit, ns) => {
    expect(parseTimestamp(input, 'auto')).toEqual({ ns, unit })
  })

  it('honours an explicit unit and fractions', () => {
    expect(parseTimestamp('1700000000', 'ms').ns).toBe(1_700_000_000_000_000n)
    expect(parseTimestamp('1.5', 's').ns).toBe(1_500_000_000n)
    expect(parseTimestamp('-1.5', 's').ns).toBe(-1_500_000_000n)
  })

  it('parses ISO 8601 and RFC 2822 dates', () => {
    expect(parseTimestamp('2023-11-14T22:13:20Z', 'auto')).toEqual({ ns: 1_700_000_000_000_000_000n, unit: undefined })
    expect(parseTimestamp('Tue, 14 Nov 2023 23:13:20 +0100', 'auto').ns).toBe(1_700_000_000_000_000_000n)
  })

  it('rejects garbage and out-of-range values', () => {
    expect(() => parseTimestamp('soon', 'auto')).toThrow(/Not a timestamp/)
    expect(() => parseTimestamp('9'.repeat(30), 'auto')).toThrow(/Out of range/)
  })

  it('detects units by magnitude', () => {
    expect(detectUnit(99_999_999_999)).toBe('s')
    expect(detectUnit(1e11)).toBe('ms')
  })
})

describe('time zones', () => {
  const d = new Date('2023-11-14T22:13:20Z')

  it('computes offsets, including half hours and DST', () => {
    expect(offsetMinutes(d, 'UTC')).toBe(0)
    expect(offsetMinutes(d, 'Asia/Kolkata')).toBe(330)
    expect(offsetMinutes(d, 'America/New_York')).toBe(-300)
    expect(offsetMinutes(new Date('2023-07-01T00:00:00Z'), 'America/New_York')).toBe(-240)
  })

  it('formats ISO 8601 and RFC 2822 in a zone', () => {
    expect(zoned(d, 'UTC')).toEqual({
      iso: '2023-11-14T22:13:20.000+00:00',
      rfc2822: 'Tue, 14 Nov 2023 22:13:20 +0000',
    })
    expect(zoned(d, 'Asia/Kolkata')).toEqual({
      iso: '2023-11-15T03:43:20.000+05:30',
      rfc2822: 'Wed, 15 Nov 2023 03:43:20 +0530',
    })
    expect(zoned(d, 'America/St_Johns').rfc2822).toBe('Tue, 14 Nov 2023 18:43:20 -0330')
  })
})

describe('relative', () => {
  const now = Date.UTC(2024, 0, 1)
  it.each([
    [now - 3 * 36e5, '3 hours ago'],
    [now + 2 * 864e5, 'in 2 days'],
    [now - 864e5, 'yesterday'],
    [now, 'now'],
    [now - 400 * 864e5, 'last year'],
  ])('%i → %s', (ms, text) => {
    expect(relative(ms, now)).toBe(text)
  })
})

describe('TimestampConverter', () => {
  it('converts as you type in the chosen zone', async () => {
    render(<TimestampConverter />)
    const input = screen.getByLabelText('Timestamp or date')
    await userEvent.clear(input)
    await userEvent.type(input, '1700000000000')
    await userEvent.selectOptions(screen.getByLabelText('Time zone'), 'Asia/Tokyo')
    expect(screen.getByText('Read as milliseconds', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('2023-11-14T22:13:20.000Z')).toBeInTheDocument()
    expect(screen.getByText('2023-11-15T07:13:20.000+09:00')).toBeInTheDocument()
  })

  it('shows an error for unparseable input', async () => {
    render(<TimestampConverter />)
    const input = screen.getByLabelText('Timestamp or date')
    await userEvent.clear(input)
    await userEvent.type(input, 'nope')
    expect(screen.getByRole('alert')).toHaveTextContent('Not a timestamp')
  })
})
