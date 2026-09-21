import { describe, expect, it } from 'vitest'
import { dailyToTuesdays, HISTORY_REPLACE_FROM, mergeWeekly, weeklyHistoryUrl } from '@/lib/market'

describe('mergeWeekly', () => {
  it('overwrites post-peak weeklies instead of only appending after the last embedded row', () => {
    const base = [
      { d: '2025-09-30', c: 118000 },
      { d: '2025-10-07', c: 1 },
      { d: '2025-10-14', c: 1 },
    ]
    const incoming = [
      { d: '2025-10-07', c: 124739.81 },
      { d: '2025-10-14', c: 115226.58 },
      { d: '2025-10-21', c: 110535.86 },
    ]
    const merged = mergeWeekly(base, incoming, HISTORY_REPLACE_FROM)
    expect(merged.find((row) => row.d === '2025-09-30')?.c).toBe(118000)
    expect(merged.find((row) => row.d === '2025-10-07')?.c).toBe(124739.81)
    expect(merged.find((row) => row.d === '2025-10-21')?.c).toBe(110535.86)
  })
})

describe('dailyToTuesdays', () => {
  it('keeps only Tuesday UTC dates', () => {
    const rows = dailyToTuesdays([
      [Date.parse('2025-10-06T00:00:00Z'), 126198],
      [Date.parse('2025-10-07T00:00:00Z'), 124739.81],
      [Date.parse('2025-10-08T00:00:00Z'), 120000],
    ])
    expect(rows).toEqual([{ d: '2025-10-07', c: 124739.81 }])
  })
})

describe('weeklyHistoryUrl', () => {
  it('requests CoinGecko range from the study peak via the Vite proxy in Node', () => {
    const url = weeklyHistoryUrl(Date.parse('2026-09-21T13:00:00Z'))
    expect(url).toContain('/api/coingecko/coins/bitcoin/market_chart/range')
    expect(url).toContain(`from=${Math.floor(Date.parse('2025-10-06T00:00:00Z') / 1000)}`)
    expect(url).not.toContain('days=400')
  })
})
