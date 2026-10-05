import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearToolState } from '@/hooks/useToolState'
import CronExplainer, { explainCron, formatRun } from './CronExplainer'

beforeEach(clearToolState)

const from = new Date('2024-01-01T00:00:00Z') // a Monday
const iso = (expr: string, tz = 'UTC', n = 3) => explainCron(expr, tz, n, from).runs.map((d) => d.toISOString())

describe('explainCron', () => {
  it('describes and schedules 5-field expressions', () => {
    const r = explainCron('0 9 * * MON-FRI', 'UTC', 2, from)
    expect(r.description).toBe('At 09:00, Monday through Friday')
    expect(r.runs.map((d) => d.toISOString())).toEqual(['2024-01-01T09:00:00.000Z', '2024-01-02T09:00:00.000Z'])
  })

  it('treats 6 fields as seconds first', () => {
    expect(iso('30 */10 * * * *')).toEqual([
      '2024-01-01T00:00:30.000Z',
      '2024-01-01T00:10:30.000Z',
      '2024-01-01T00:20:30.000Z',
    ])
  })

  it('supports macros', () => {
    expect(explainCron('@daily', 'UTC', 1, from).description).toBe('At 00:00')
    expect(iso('@weekly', 'UTC', 1)).toEqual(['2024-01-07T00:00:00.000Z'])
  })

  it('evaluates in the given time zone, across DST', () => {
    expect(iso('0 9 * * *', 'America/New_York', 1)).toEqual(['2024-01-01T14:00:00.000Z'])
    const summer = explainCron('0 9 * * *', 'America/New_York', 1, new Date('2024-07-01T00:00:00Z'))
    expect(summer.runs[0]?.toISOString()).toBe('2024-07-01T13:00:00.000Z')
  })

  it('ORs day of month and day of week like Vixie cron', () => {
    expect(iso('0 0 13 * 5')).toEqual([
      '2024-01-05T00:00:00.000Z',
      '2024-01-12T00:00:00.000Z',
      '2024-01-13T00:00:00.000Z',
    ])
  })

  it('returns no runs for impossible dates', () => {
    expect(iso('0 0 30 2 *')).toEqual([])
  })

  it('rejects invalid and 7-field expressions', () => {
    expect(() => explainCron('61 * * * *', 'UTC', 1)).toThrow()
    expect(() => explainCron('* * * * * * *', 'UTC', 1)).toThrow(/5 or 6 parts/)
    expect(() => explainCron('nope', 'UTC', 1)).toThrow()
  })

  it('formats runs in the time zone', () => {
    expect(formatRun(new Date('2024-01-01T14:00:00Z'), 'America/New_York')).toBe('Mon, Jan 1, 2024, 09:00:00 EST')
  })
})

describe('CronExplainer', () => {
  it('explains as you type and shows errors', async () => {
    render(<CronExplainer />)
    const input = screen.getByLabelText('Cron expression')
    await userEvent.clear(input)
    await userEvent.paste('*/15 * * * *')
    expect(screen.getByText('Every 15 minutes')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(10)
    await userEvent.type(input, ' x')
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
