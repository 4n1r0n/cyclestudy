import { addDays, clamp, daysBetween, isoDate, mean, median, toTime, utcDay } from '@/lib/dates'
import { formatMoney } from '@/lib/format'
import type {
  AnalogCycle,
  AnalogId,
  AnalogPoint,
  CycleData,
  CycleEvent,
  EnvelopePoint,
  ForwardPath,
  IntervalRow,
  Invalidation,
  PhaseInfo,
  PricePoint,
  ProjectionMode,
  ProjectionOrigin,
  Quote,
  WorkingConfig,
} from '@/lib/types'

export const ANCHOR = { date: '2025-10-06', price: 126198.07 } as const

export const CLASSIC_CONFIG: WorkingConfig = {
  bearDays: 364,
  bullDays: 1064,
  toleranceDays: 14,
  bottom: { low: 18614.22, high: 28621.72 },
  top: { low: 150589, high: 617084.33 },
}

export const EVENTS: CycleEvent[] = [
  { date: '2013-12-03', price: 1163, type: 'top', approximate: true },
  { date: '2015-01-14', price: 171.51, type: 'bottom' },
  { date: '2017-12-17', price: 20089, type: 'top' },
  { date: '2018-12-15', price: 3191.3, type: 'bottom' },
  { date: '2021-11-10', price: 68789.63, type: 'top' },
  { date: '2022-11-21', price: 15599.05, type: 'bottom' },
  { date: ANCHOR.date, price: ANCHOR.price, type: 'top' },
]

export const ANALOG_DEFS: {
  id: AnalogId
  label: string
  color: string
  peakDate: string
  bottomDate: string
  nextPeakDate: string
}[] = [
  {
    id: '2015',
    label: '2015 analog',
    color: '#92b6ff',
    peakDate: '2013-12-03',
    bottomDate: '2015-01-14',
    nextPeakDate: '2017-12-17',
  },
  {
    id: '2018',
    label: '2018 analog',
    color: '#d4a5ff',
    peakDate: '2017-12-17',
    bottomDate: '2018-12-15',
    nextPeakDate: '2021-11-10',
  },
  {
    id: '2022',
    label: '2022 analog',
    color: '#5eead4',
    peakDate: '2021-11-10',
    bottomDate: '2022-11-21',
    nextPeakDate: '2025-10-06',
  },
]

export const OUTER_2013_BEAR_EXTRA = 43

export function nearestWeekly(prices: PricePoint[], date: string): PricePoint {
  const t = toTime(date)
  let best = prices[0]
  let bestAbs = Infinity
  for (const row of prices) {
    const delta = Math.abs(toTime(row.d) - t)
    if (delta < bestAbs) {
      best = row
      bestAbs = delta
    }
  }
  return best
}

export function validateData(data: CycleData): void {
  if (!Array.isArray(data.prices) || data.prices.length < 2 || !Array.isArray(data.envelope) || data.envelope.length < 2) {
    throw new Error('The study data is incomplete.')
  }
  let previous = -Infinity
  let previousDate: string | null = null
  for (const row of data.prices) {
    const time = toTime(row.d)
    if (!Number.isFinite(time) || time <= previous || !Number.isFinite(row.c) || row.c <= 0) {
      throw new Error('Historical prices must be positive and ordered by date.')
    }
    if (previousDate) {
      const gap = daysBetween(previousDate, row.d)
      if (gap !== 7) {
        throw new Error(`Weekly series is not 7-day spaced (${previousDate} → ${row.d} is ${gap} days).`)
      }
    }
    previous = time
    previousDate = row.d
  }
  previous = -Infinity
  for (const row of data.envelope) {
    if (
      ![row.t, row.min, row.avg, row.max].every(Number.isFinite) ||
      row.t <= previous ||
      row.t < 0 ||
      row.t > 1 ||
      row.min <= 0 ||
      row.min > row.avg ||
      row.avg > row.max
    ) {
      throw new Error('The historical envelope contains an invalid range.')
    }
    previous = row.t
  }
  if (data.envelope[0].t !== 0 || data.envelope.at(-1)?.t !== 1) {
    throw new Error('The historical envelope must cover the full cycle.')
  }
}

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u
}

export function interpolateEnvelope(envelope: EnvelopePoint[], t: number): EnvelopePoint {
  if (t <= 0) return envelope[0]
  if (t >= 1) return envelope.at(-1)!
  let i = 1
  while (i < envelope.length && envelope[i].t < t) i += 1
  const a = envelope[i - 1]
  const b = envelope[i]
  const u = (t - a.t) / (b.t - a.t)
  return {
    t,
    min: lerp(a.min, b.min, u),
    avg: lerp(a.avg, b.avg, u),
    max: lerp(a.max, b.max, u),
  }
}

export function interpolateAnalog(points: AnalogPoint[], days: number): AnalogPoint | null {
  if (points.length === 0) return null
  if (days <= points[0].days) return points[0]
  if (days >= points.at(-1)!.days) return points.at(-1)!
  let i = 1
  while (i < points.length && points[i].days < days) i += 1
  const a = points[i - 1]
  const b = points[i]
  const u = (days - a.days) / (b.days - a.days)
  return {
    days,
    date: addDays(ANCHOR.date, days),
    analogPrice: lerp(a.analogPrice, b.analogPrice, u),
    scaled: lerp(a.scaled, b.scaled, u),
  }
}

export function buildAnalogs(prices: PricePoint[]): AnalogCycle[] {
  return ANALOG_DEFS.map((def) => {
    const peakWeekly = nearestWeekly(prices, def.peakDate)
    const bottomWeekly = nearestWeekly(prices, def.bottomDate)
    const nextPeakWeekly = nearestWeekly(prices, def.nextPeakDate)
    const peakT = toTime(def.peakDate)
    const endT = toTime(def.nextPeakDate) + 21 * 86400000
    const points: AnalogPoint[] = prices
      .filter((row) => {
        const t = toTime(row.d)
        return t >= peakT && t <= endT
      })
      .map((row) => {
        const days = daysBetween(def.peakDate, row.d)
        return {
          days,
          date: addDays(ANCHOR.date, days),
          analogPrice: row.c,
          scaled: (row.c / peakWeekly.c) * ANCHOR.price,
        }
      })
    const remainingAtBottom = bottomWeekly.c / peakWeekly.c
    const bullMultiple = nextPeakWeekly.c / bottomWeekly.c
    return {
      id: def.id,
      label: def.label,
      color: def.color,
      peakDate: def.peakDate,
      bottomDate: def.bottomDate,
      nextPeakDate: def.nextPeakDate,
      peakWeekly,
      bottomWeekly,
      nextPeakWeekly,
      bearDays: daysBetween(def.peakDate, def.bottomDate),
      bullDays: daysBetween(def.bottomDate, def.nextPeakDate),
      remainingAtBottom,
      impliedBottom: remainingAtBottom * ANCHOR.price,
      bullMultiple,
      points,
    }
  })
}

export function analogWorkingConfig(analogs: AnalogCycle[]): WorkingConfig {
  const nonApproxBears = analogs.filter((a) => a.id !== '2015').map((a) => a.bearDays)
  const bulls = analogs.map((a) => a.bullDays)
  const impliedBottoms = analogs.map((a) => a.impliedBottom)
  const laterBulls = analogs.filter((a) => a.id !== '2015')
  const medianBottom = median(impliedBottoms)
  const laterMultiples = laterBulls.map((a) => a.bullMultiple)
  return {
    bearDays: Math.round(median(nonApproxBears)),
    bullDays: Math.round(median(bulls)),
    toleranceDays: 14,
    bottom: { low: Math.min(...impliedBottoms), high: Math.max(...impliedBottoms) },
    top: {
      low: Math.min(...laterMultiples) * medianBottom,
      high: Math.max(...laterMultiples) * medianBottom,
    },
  }
}

export function buildIntervals(config: WorkingConfig): IntervalRow[] {
  return EVENTS.slice(1).map((to, i) => {
    const from = EVENTS[i]
    const phase = from.type === 'top' ? 'bear' : 'bull'
    const expected = phase === 'bear' ? config.bearDays : config.bullDays
    const actual = daysBetween(from.date, to.date)
    const approximate = Boolean(from.approximate || to.approximate)
    const endsAtAnchor = to.date === ANCHOR.date
    return {
      from,
      to,
      phase,
      expected,
      actual,
      difference: actual - expected,
      approximate,
      endsAtAnchor,
      honest: !approximate && !endsAtAnchor,
    }
  })
}

export function maeFor(rows: IntervalRow[]): number {
  if (rows.length === 0) return NaN
  return mean(rows.map((row) => Math.abs(row.difference)))
}

export function leaveOneOutMae(intervals: IntervalRow[]): number {
  const bears = intervals.filter((row) => row.phase === 'bear' && !row.approximate).map((row) => row.actual)
  const bulls = intervals.filter((row) => row.phase === 'bull' && !row.endsAtAnchor).map((row) => row.actual)
  const errors: number[] = []
  for (let i = 0; i < bears.length; i += 1) {
    const others = bears.filter((_, j) => j !== i)
    if (others.length === 0) continue
    errors.push(Math.abs(bears[i] - median(others)))
  }
  for (let i = 0; i < bulls.length; i += 1) {
    const others = bulls.filter((_, j) => j !== i)
    if (others.length === 0) continue
    errors.push(Math.abs(bulls[i] - median(others)))
  }
  return mean(errors)
}

export type Study = {
  data: CycleData
  config: WorkingConfig
  mode: ProjectionMode
  analogDefaults: WorkingConfig
  targets: {
    bottom: { date: string; low: number; high: number }
    top: { date: string; low: number; high: number }
  }
  intervals: IntervalRow[]
  honestMae: number
  allMae: number
  looMae: number
  withinTolerance: { count: number; total: number }
  analogs: AnalogCycle[]
  envelope: { x: number; t: number; min: number; max: number; avg: number }[]
  latestWeekly: PricePoint
  firstWeekly: PricePoint
}

export function createStudy(input: CycleData, config: WorkingConfig, mode: ProjectionMode = 'analog'): Study {
  validateData(input)
  const analogs = buildAnalogs(input.prices)
  const analogDefaults = analogWorkingConfig(analogs)
  const bottomDate = addDays(ANCHOR.date, config.bearDays)
  const topDate = addDays(bottomDate, config.bullDays)
  const intervals = buildIntervals(config)
  const honest = intervals.filter((row) => row.honest)
  const span = toTime(topDate) - toTime(ANCHOR.date)
  const envelope = input.envelope.map((row) => ({
    x: toTime(ANCHOR.date) + row.t * span,
    t: row.t,
    min: row.min * ANCHOR.price,
    max: row.max * ANCHOR.price,
    avg: row.avg * ANCHOR.price,
  }))
  const within = intervals.filter((row) => row.honest)
  return {
    data: input,
    config,
    mode,
    analogDefaults,
    targets: {
      bottom: { date: bottomDate, low: config.bottom.low, high: config.bottom.high },
      top: { date: topDate, low: config.top.low, high: config.top.high },
    },
    intervals,
    honestMae: maeFor(honest),
    allMae: maeFor(intervals),
    looMae: leaveOneOutMae(intervals),
    withinTolerance: {
      count: within.filter((row) => Math.abs(row.difference) <= config.toleranceDays).length,
      total: within.length,
    },
    analogs,
    envelope,
    latestWeekly: input.prices.at(-1)!,
    firstWeekly: input.prices[0],
  }
}

export function phaseAt(study: Study, now: string | number | Date): PhaseInfo {
  const day = utcDay(now)
  const start = toTime(ANCHOR.date)
  const bottom = toTime(study.targets.bottom.date)
  const top = toTime(study.targets.top.date)
  if (day < start) {
    return {
      name: 'Before anchor',
      elapsed: 0,
      duration: 0,
      displayDay: null,
      progress: 0,
      next: ANCHOR.date,
      copy: `Anchor: ${isoDate(ANCHOR.date)}`,
    }
  }
  if (day >= top) {
    return {
      name: 'Horizon reached',
      elapsed: daysBetween(study.targets.top.date, day),
      duration: 0,
      displayDay: null,
      progress: 100,
      next: null,
      copy: 'The projection period has ended',
    }
  }
  const bear = day < bottom
  const startDate = bear ? ANCHOR.date : study.targets.bottom.date
  const duration = bear ? study.config.bearDays : study.config.bullDays
  const elapsed = daysBetween(startDate, day)
  const displayDay = Math.min(elapsed + 1, duration)
  const name = bear ? 'Modeled bear' : 'Modeled bull'
  const copy =
    !bear && elapsed === 0
      ? `Day 1 of ${duration.toLocaleString('en-US')} · bottom date (start of modeled bull)`
      : `Day ${displayDay.toLocaleString('en-US')} of ${duration.toLocaleString('en-US')}`
  return {
    name,
    elapsed,
    duration,
    displayDay,
    progress: clamp((displayDay / duration) * 100),
    next: bear ? study.targets.bottom.date : study.targets.top.date,
    copy,
  }
}

export function cycleFraction(study: Study, now: string | number | Date): number {
  const total = study.config.bearDays + study.config.bullDays
  const elapsed = Math.max(0, daysBetween(ANCHOR.date, now))
  return clamp(elapsed / total, 0, 1)
}

export function projectionOrigin(study: Study, now: string | number | Date, quote: Quote | null): ProjectionOrigin {
  if (quote && Number.isFinite(quote.price) && quote.price > 0) {
    return {
      t: quote.timestamp,
      date: isoDate(quote.timestamp),
      price: quote.price,
      days: Math.max(0, daysBetween(ANCHOR.date, quote.timestamp)),
      source: 'live',
    }
  }
  const t = toTime(now)
  return {
    t,
    date: isoDate(t),
    price: study.latestWeekly.c,
    days: Math.max(0, daysBetween(ANCHOR.date, t)),
    source: 'weekly',
  }
}

export function analogForwardPaths(study: Study, now: string | number | Date, spot: number): ForwardPath[] {
  const originT = toTime(now)
  const originDate = isoDate(originT)
  const daysNow = Math.max(0, daysBetween(ANCHOR.date, originT))
  return study.analogs.map((analog) => {
    const here = interpolateAnalog(analog.points, daysNow)
    const scale = here && here.scaled > 0 ? spot / here.scaled : 1
    const rest = analog.points
      .filter((point) => point.days > daysNow)
      .map((point) => ({
        date: point.date,
        days: point.days,
        price: point.scaled * scale,
        t: toTime(point.date),
      }))
    return {
      id: analog.id,
      label: `${analog.label} from today`,
      color: analog.color,
      points: [{ date: originDate, days: daysNow, price: spot, t: originT }, ...rest],
    }
  })
}

export function envelopeFromOrigin(
  study: Study,
  origin: ProjectionOrigin,
): { x: number; min: number; avg: number; max: number }[] {
  const t0 = cycleFraction(study, origin.t)
  const band0 = interpolateEnvelope(study.data.envelope, t0)
  const min0 = band0.min * ANCHOR.price
  const avg0 = band0.avg * ANCHOR.price
  const max0 = band0.max * ANCHOR.price
  const rows = [
    { x: origin.t, min: origin.price, avg: origin.price, max: origin.price },
  ]
  for (const row of study.envelope) {
    if (row.x <= origin.t) continue
    rows.push({
      x: row.x,
      min: min0 > 0 ? origin.price * (row.min / min0) : origin.price,
      avg: avg0 > 0 ? origin.price * (row.avg / avg0) : origin.price,
      max: max0 > 0 ? origin.price * (row.max / max0) : origin.price,
    })
  }
  return rows
}

export function workingModelPath(
  study: Study,
  origin: ProjectionOrigin,
): { t: number; mid: number; low: number; high: number }[] {
  const points = [{ t: origin.t, mid: origin.price, low: origin.price, high: origin.price }]
  const bottomT = toTime(study.targets.bottom.date)
  const topT = toTime(study.targets.top.date)
  if (bottomT > origin.t) {
    points.push({
      t: bottomT,
      mid: (study.targets.bottom.low + study.targets.bottom.high) / 2,
      low: study.targets.bottom.low,
      high: study.targets.bottom.high,
    })
  }
  if (topT > origin.t) {
    points.push({
      t: topT,
      mid: (study.targets.top.low + study.targets.top.high) / 2,
      low: study.targets.top.low,
      high: study.targets.top.high,
    })
  }
  return points
}

export function analogRemainingDrop(analog: AnalogCycle, daysNow: number): number | null {
  if (daysNow >= analog.bearDays) return 0
  const here = interpolateAnalog(analog.points, daysNow)
  if (!here || here.scaled <= 0) return null
  const remaining = 1 - analog.impliedBottom / here.scaled
  return remaining
}

export function buildInvalidation(
  study: Study,
  now: string | number | Date,
  price: number,
): Invalidation {
  const phase = phaseAt(study, now)
  const t = cycleFraction(study, now)
  const band = interpolateEnvelope(study.data.envelope, t)
  const envMin = band.min * ANCHOR.price
  const envMax = band.max * ANCHOR.price
  let envelopePercentile: number | null = null
  let spotVsEnvelope: Invalidation['spotVsEnvelope'] = null
  if (price < envMin) {
    envelopePercentile = 0
    spotVsEnvelope = 'below'
  } else if (price > envMax) {
    envelopePercentile = 100
    spotVsEnvelope = 'above'
  } else {
    envelopePercentile = ((price - envMin) / (envMax - envMin)) * 100
    spotVsEnvelope = 'inside'
  }

  if (phase.name !== 'Modeled bear') {
    return {
      status: 'consistent',
      title: phase.name === 'Modeled bull' ? 'Bear window has passed' : 'Outside the modeled bear',
      detail:
        phase.name === 'Modeled bull'
          ? 'The working clock is already in modeled bull. Bottom-range invalidation no longer applies; treat analog bull paths as the live reference.'
          : 'Invalidation is evaluated while the working clock is inside the modeled bear.',
      daysLeft: null,
      requiredDropHigh: null,
      requiredDropLow: null,
      envelopePercentile,
      spotVsEnvelope,
      analogRemainingMax: null,
    }
  }

  const daysLeft = daysBetween(now, study.targets.bottom.date)
  const requiredDropHigh = 1 - study.targets.bottom.high / price
  const requiredDropLow = 1 - study.targets.bottom.low / price
  const daysNow = daysBetween(ANCHOR.date, now)
  const remaining = study.analogs
    .map((analog) => analogRemainingDrop(analog, daysNow))
    .filter((value): value is number => value !== null)
  const analogRemainingMax = remaining.length ? Math.max(...remaining) : null

  let status: Invalidation['status'] = 'consistent'
  let title = 'Path still compatible with the working range'
  let detail = `Spot is ${((price / ANCHOR.price) * 100).toFixed(0)}% of the study peak. Analog remaining drawdowns from this day-count top out around ${analogRemainingMax === null ? 'n/a' : `${(analogRemainingMax * 100).toFixed(0)}%`}.`

  const cannotHitHigh = requiredDropHigh > 0 && (daysLeft <= 0 || (analogRemainingMax !== null && requiredDropHigh > analogRemainingMax + 0.05))
  const extremeShort = requiredDropHigh > 0.4 && daysLeft <= 21
  const envelopeBreak = spotVsEnvelope === 'above' && price > envMax * 1.25

  if (cannotHitHigh || extremeShort || (daysLeft <= 0 && price > study.targets.bottom.high)) {
    status = 'invalidated'
    title = 'Price path vs timing clock — range not reachable'
    detail = `To land in ${formatMoney(study.targets.bottom.low)}–${formatMoney(study.targets.bottom.high)} with ${Math.max(daysLeft, 0)} modeled day${Math.max(daysLeft, 0) === 1 ? '' : 's'} left, price would need to fall ${(requiredDropHigh * 100).toFixed(0)}% (to the top of the range) or ${(requiredDropLow * 100).toFixed(0)}% (to the floor). No 2015/2018/2022 analog still has that much remaining drawdown from this day-count. Treat the date as a clock, not a price target.`
  } else if (requiredDropHigh > 0.25 || envelopeBreak || (analogRemainingMax !== null && requiredDropHigh > analogRemainingMax)) {
    status = 'stressed'
    title = 'Path is stretched vs analogs and the envelope'
    detail = `Hitting the working bottom range still requires a ${(requiredDropHigh * 100).toFixed(0)}% decline in ${daysLeft} days. Spot sits ${spotVsEnvelope === 'above' ? 'above' : 'inside'} the imported envelope at t=${t.toFixed(3)}. The clock can still run; the dollar range is the stressed claim.`
  }

  return {
    status,
    title,
    detail,
    daysLeft,
    requiredDropHigh,
    requiredDropLow,
    envelopePercentile,
    spotVsEnvelope,
    analogRemainingMax,
  }
}

export function relativeDate(date: string | number | Date, now: string | number | Date): string {
  const days = daysBetween(now, date)
  const unit = Math.abs(days) === 1 ? 'day' : 'days'
  if (days > 0) return `In ${days.toLocaleString('en-US')} ${unit}`
  if (days < 0) return `${Math.abs(days).toLocaleString('en-US')} ${unit} ago`
  return 'Today'
}

export function quoteIsFresh(quote: Quote | null, now: number, maxAgeMs = 15 * 60 * 1000): boolean {
  return Boolean(quote && now - quote.timestamp <= maxAgeMs && quote.timestamp - now <= 60 * 1000)
}

export type DrawdownError = {
  predictedCycle: AnalogId
  predictedRemaining: number
  actualRemaining: number
  errorPp: number
}

export function analogPriceErrors(analogs: AnalogCycle[]): DrawdownError[] {
  const errors: DrawdownError[] = []
  for (let i = 0; i < analogs.length - 1; i += 1) {
    const prior = analogs.slice(0, i + 1)
    const predicted = median(prior.map((a) => a.remainingAtBottom))
    const actual = analogs[i + 1].remainingAtBottom
    errors.push({
      predictedCycle: analogs[i + 1].id,
      predictedRemaining: predicted,
      actualRemaining: actual,
      errorPp: (actual - predicted) * 100,
    })
  }
  return errors
}

export function windowBounds(
  id: string,
  latestWeekly: string,
  bottomDate: string,
  now: string | number | Date,
): [string, string] {
  if (id === '2013-2017') return ['2012-11-01', '2018-01-09']
  if (id === '2017-2021') return ['2017-11-21', '2022-01-18']
  if (id === '2021-2025') {
    const endCandidates = [latestWeekly, bottomDate, isoDate(now)]
    const end = endCandidates.sort()[endCandidates.length - 1]
    return ['2021-09-21', end]
  }
  if (id === '2025-2029') return ['2025-08-19', '2030-01-10']
  return ['2012-11-01', '2030-01-10']
}

export function windowHasProjection(start: string, end: string, topDate: string): boolean {
  return toTime(end) > toTime(ANCHOR.date) && toTime(start) < toTime(topDate)
}
