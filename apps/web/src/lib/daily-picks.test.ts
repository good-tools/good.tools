import { describe, expect, it } from 'vitest'
import { dailyPicks, today } from './daily-picks'

const items = Array.from({ length: 30 }, (_, i) => i)

describe('dailyPicks', () => {
  it('is stable for a day and distinct', () => {
    const a = dailyPicks(items, '2026-10-05')
    expect(dailyPicks(items, '2026-10-05')).toEqual(a)
    expect(new Set(a).size).toBe(3)
  })

  it('changes from day to day', () => {
    const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'].map((d) => dailyPicks(items, d).join())
    expect(new Set(days).size).toBeGreaterThan(1)
  })

  it('handles fewer items than asked for', () => {
    expect(dailyPicks([1, 2], 'x').sort()).toEqual([1, 2])
  })

  it('formats the local date', () => {
    expect(today(new Date(2026, 0, 9))).toBe('2026-01-09')
  })
})
