export type PricePoint = {
  d: string
  c: number
}

export type EnvelopePoint = {
  t: number
  min: number
  avg: number
  max: number
}

export type CycleSource = {
  name: string
  historyThrough: string
  embeddedThrough?: string
  stubDropped?: string
  extension?: {
    provider: string
    endpoint: string
    method: string
    from: string
    to: string
    fetchedAt: string
  }
  historyDescription: string
  envelopeDescription: string
}

export type CycleData = {
  prices: PricePoint[]
  envelope: EnvelopePoint[]
  source: CycleSource
}

export type EventType = 'top' | 'bottom'

export type CycleEvent = {
  date: string
  price: number
  type: EventType
  approximate?: boolean
}

export type PriceRange = {
  low: number
  high: number
}

export type WorkingConfig = {
  bearDays: number
  bullDays: number
  toleranceDays: number
  bottom: PriceRange
  top: PriceRange
}

export type ProjectionMode = 'analog' | 'classic'

export type WindowId = 'all' | '2013-2017' | '2017-2021' | '2021-2025' | '2025-2029'

export type ScaleId = 'log' | 'linear'

export type Quote = {
  price: number
  timestamp: number
  fetchedAt: number
  source: string
}

export type QuoteError = {
  message: string
  kind: 'http' | 'abort' | 'stale' | 'future' | 'invalid' | 'cors' | 'network' | 'parse'
}

export type IntervalRow = {
  from: CycleEvent
  to: CycleEvent
  phase: 'bear' | 'bull'
  expected: number
  actual: number
  difference: number
  approximate: boolean
  endsAtAnchor: boolean
  honest: boolean
}

export type AnalogId = '2015' | '2018' | '2022'

export type AnalogPoint = {
  days: number
  date: string
  analogPrice: number
  scaled: number
}

export type AnalogCycle = {
  id: AnalogId
  label: string
  color: string
  peakDate: string
  bottomDate: string
  nextPeakDate: string
  peakWeekly: PricePoint
  bottomWeekly: PricePoint
  nextPeakWeekly: PricePoint
  bearDays: number
  bullDays: number
  remainingAtBottom: number
  impliedBottom: number
  bullMultiple: number
  points: AnalogPoint[]
}

export type ForwardPath = {
  id: AnalogId
  label: string
  color: string
  points: { date: string; days: number; price: number; t: number }[]
}

export type PhaseInfo = {
  name: 'Before anchor' | 'Modeled bear' | 'Modeled bull' | 'Horizon reached'
  elapsed: number
  duration: number
  displayDay: number | null
  progress: number
  next: string | null
  copy: string
}

export type Invalidation = {
  status: 'consistent' | 'stressed' | 'invalidated'
  title: string
  detail: string
  daysLeft: number | null
  requiredDropHigh: number | null
  requiredDropLow: number | null
  envelopePercentile: number | null
  spotVsEnvelope: 'below' | 'inside' | 'above' | null
  analogRemainingMax: number | null
}

export type DisplayedPrice = {
  value: number
  kind: 'live' | 'weekly'
  asOf: number
  label: string
  snapshot: boolean
}

export type LegendKey =
  | 'phases'
  | 'analog2015'
  | 'analog2018'
  | 'analog2022'
  | 'envMin'
  | 'envAvg'
  | 'envMax'
  | 'fan'
  | 'classic'
  | 'bands'

export type LegendState = Record<LegendKey, boolean>

export const DEFAULT_LEGEND: LegendState = {
  phases: false,
  analog2015: false,
  analog2018: false,
  analog2022: false,
  envMin: false,
  envAvg: false,
  envMax: false,
  fan: false,
  classic: false,
  bands: false,
}

export type ProjectionOrigin = {
  t: number
  date: string
  price: number
  days: number
  source: 'live' | 'weekly'
}
