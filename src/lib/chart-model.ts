import { toTime } from '@/lib/dates'
import type { ScaleId } from '@/lib/types'

export function computeYDomain(opts: {
  primary: number[]
  extras?: number[]
  scale: ScaleId
}): [number, number] {
  const primary = opts.primary.filter((value) => Number.isFinite(value) && value > 0)
  if (primary.length === 0) return opts.scale === 'log' ? [1000, 200000] : [1000, 200000]
  let min = Math.min(...primary)
  let max = Math.max(...primary)
  const cap = max * (opts.scale === 'log' ? 3.2 : 1.45)
  const floor = min / (opts.scale === 'log' ? 2.4 : 1.35)
  for (const value of opts.extras ?? []) {
    if (!Number.isFinite(value) || value <= 0) continue
    if (value > cap || value < floor) continue
    min = Math.min(min, value)
    max = Math.max(max, value)
  }
  if (opts.scale === 'log') {
    return [Math.max(1, min / 1.25), max * 1.35]
  }
  return [min * 0.92, max * 1.12]
}

export function visibleTimes(start: number, end: number, times: number[]): number[] {
  return times.filter((time) => time >= start && time <= end)
}

export function toChartX(date: string | number): number {
  return toTime(date)
}
