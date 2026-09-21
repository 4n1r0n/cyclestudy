import { describe, expect, it } from 'vitest'
import cycleData from '@/data/cycle-data.json'
import { daysBetween } from '@/lib/dates'
import {
  ANCHOR,
  CLASSIC_CONFIG,
  analogForwardPaths,
  analogWorkingConfig,
  buildAnalogs,
  buildInvalidation,
  createStudy,
  envelopeFromOrigin,
  nearestWeekly,
  phaseAt,
  projectionOrigin,
  validateData,
  windowBounds,
  workingModelPath,
} from '@/lib/study'
import type { CycleData } from '@/lib/types'

const data = cycleData as CycleData

describe('weekly series', () => {
  it('uses CoinGecko actuals from the Oct 2025 peak through the last Tuesday', () => {
    expect(() => validateData(data)).not.toThrow()
    expect(data.prices.some((row) => row.d === '2026-03-29')).toBe(false)
    expect(data.prices.at(-1)?.d).toBe('2026-09-15')
    expect(data.source.embeddedThrough).toBe('2025-09-30')
    expect(data.source.extension?.provider).toBe('CoinGecko')
    expect(data.source.extension?.from).toBe('2025-10-07')
    expect(data.prices.find((row) => row.d === '2025-10-07')?.c).toBeCloseTo(124739.81, 1)
    expect(data.prices.find((row) => row.d === '2025-12-02')?.c).toBeCloseTo(86303.9, 1)
    expect(data.prices.find((row) => row.d === '2026-09-15')?.c).toBeCloseTo(78173.35, 1)
    expect(daysBetween('2025-09-30', '2025-10-07')).toBe(7)
  })
})

describe('phase fencepost', () => {
  it('shows Day 1 on the anchor and Day 364 on the last bear day', () => {
    const study = createStudy(data, CLASSIC_CONFIG, 'classic')
    const start = phaseAt(study, '2025-10-06')
    expect(start.name).toBe('Modeled bear')
    expect(start.displayDay).toBe(1)
    expect(start.copy).toContain('Day 1 of 364')

    const lastBear = phaseAt(study, '2026-10-04')
    expect(lastBear.name).toBe('Modeled bear')
    expect(lastBear.displayDay).toBe(364)

    const bottom = phaseAt(study, '2026-10-05')
    expect(bottom.name).toBe('Modeled bull')
    expect(bottom.displayDay).toBe(1)
    expect(bottom.copy).toMatch(/bottom date/i)
  })
})

describe('honest MAE', () => {
  it('excludes the approximate 2013 row and the in-sample 2022–2025 anchor bull', () => {
    const study = createStudy(data, CLASSIC_CONFIG, 'classic')
    const honest = study.intervals.filter((row) => row.honest)
    expect(honest).toHaveLength(4)
    expect(honest.some((row) => row.approximate)).toBe(false)
    expect(honest.some((row) => row.endsAtAnchor)).toBe(false)
    expect(study.honestMae).toBeCloseTo(5.0, 5)
    expect(study.allMae).toBeCloseTo(12.8333, 2)
  })
})

describe('analog calibration', () => {
  it('rebuilds bottom prices from weekly-close drawdowns, not the classic $18.6k–$28.6k constants', () => {
    const analogs = buildAnalogs(data.prices)
    const cfg = analogWorkingConfig(analogs)
    expect(cfg.bottom.low).toBeGreaterThan(20000)
    expect(cfg.bottom.high).toBeGreaterThan(cfg.bottom.low)
    expect(cfg.bottom.high).toBeLessThan(40000)
    expect(cfg.bearDays).toBeGreaterThanOrEqual(363)
    expect(cfg.bearDays).toBeLessThanOrEqual(376)
    expect(Math.abs(cfg.bottom.low - CLASSIC_CONFIG.bottom.low)).toBeGreaterThan(1000)
  })
})

describe('invalidation', () => {
  it('flags when $85k cannot reach the classic bottom range in 14 modeled days', () => {
    const study = createStudy(data, CLASSIC_CONFIG, 'classic')
    const result = buildInvalidation(study, '2026-09-21', 85000)
    expect(result.status).toBe('invalidated')
    expect(result.daysLeft).toBe(14)
    expect(result.requiredDropHigh).toBeGreaterThan(0.6)
  })
})

describe('windows', () => {
  it('extends 2021–2025 through latest weekly data', () => {
    const [, end] = windowBounds('2021-2025', '2026-09-15', '2026-10-11', '2026-09-21')
    expect(end >= '2026-09-15').toBe(true)
  })
})

describe('event weekly alignment', () => {
  it('finds a weekly close near the 2017 event that is well below the $20,089 print', () => {
    const weekly = nearestWeekly(data.prices, '2017-12-17')
    expect(weekly.c).toBeLessThan(18000)
    expect(Math.abs(daysBetween(weekly.d, '2017-12-17'))).toBeLessThanOrEqual(3)
  })
})

describe('anchor', () => {
  it('keeps the 6 Oct 2025 study peak', () => {
    expect(ANCHOR.date).toBe('2025-10-06')
    expect(ANCHOR.price).toBeCloseTo(126198.07)
  })
})

describe('projections from today', () => {
  const study = createStudy(data, analogWorkingConfig(buildAnalogs(data.prices)), 'analog')
  const quote = {
    price: 85427,
    timestamp: Date.parse('2026-09-21T13:46:00Z'),
    fetchedAt: Date.parse('2026-09-21T13:46:20Z'),
    source: 'CoinGecko',
  }

  it('originates analog remaining paths at the live print, not at analog-implied history', () => {
    const origin = projectionOrigin(study, quote.timestamp, quote)
    expect(origin.price).toBe(85427)
    expect(origin.source).toBe('live')
    const paths = analogForwardPaths(study, origin.t, origin.price)
    expect(paths).toHaveLength(3)
    for (const path of paths) {
      expect(path.points[0].price).toBeCloseTo(85427, 5)
      expect(path.points[0].date).toBe('2026-09-21')
      expect(path.points[0].t).toBe(quote.timestamp)
      expect(path.points.every((point) => point.t >= quote.timestamp)).toBe(true)
    }
  })

  it('rebases envelope min/mean/max through today’s price and only after the origin', () => {
    const origin = projectionOrigin(study, quote.timestamp, quote)
    const env = envelopeFromOrigin(study, origin)
    expect(env[0]).toMatchObject({ min: 85427, avg: 85427, max: 85427 })
    expect(env.every((row) => row.x >= origin.t)).toBe(true)
    expect(env.at(-1)!.max).toBeGreaterThan(env[0].max)
  })

  it('starts the working model path at the live print', () => {
    const origin = projectionOrigin(study, quote.timestamp, quote)
    const path = workingModelPath(study, origin)
    expect(path[0]).toMatchObject({ t: origin.t, mid: 85427 })
    expect(path.every((row) => row.t >= origin.t)).toBe(true)
  })
})
