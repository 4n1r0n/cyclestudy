export const DAY = 86_400_000

export function toTime(value: string | number | Date): number {
  if (typeof value === 'number') return value
  if (value instanceof Date) return value.getTime()
  return Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value)
}

export function utcDay(value: string | number | Date): number {
  return Math.floor(toTime(value) / DAY) * DAY
}

export function isoDate(value: string | number | Date): string {
  return new Date(toTime(value)).toISOString().slice(0, 10)
}

export function daysBetween(from: string | number | Date, to: string | number | Date): number {
  return Math.round((utcDay(to) - utcDay(from)) / DAY)
}

export function addDays(date: string | number | Date, count: number): string {
  return isoDate(utcDay(date) + count * DAY)
}

export function weekdayUtc(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

export function isTuesday(date: string): boolean {
  return weekdayUtc(date) === 2
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

export function median(values: number[]): number {
  if (values.length === 0) return NaN
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export function mean(values: number[]): number {
  if (values.length === 0) return NaN
  return values.reduce((sum, value) => sum + value, 0) / values.length
}
