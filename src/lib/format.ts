import { toTime } from '@/lib/dates'

const DATE: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
}

const DATETIME: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
  hourCycle: 'h23',
}

export function formatDate(value: string | number | Date): string {
  return new Intl.DateTimeFormat('en-US', DATE).format(toTime(value))
}

export function formatDateTime(value: string | number | Date): string {
  return `${new Intl.DateTimeFormat('en-US', DATETIME).format(toTime(value))} UTC`
}

export function formatMoney(value: number): string {
  const abs = Math.abs(value)
  const digits = abs >= 100 ? 0 : abs >= 1 ? 2 : 4
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

/** Compact under $100k; full currency at $100k+ so cards match table scale. */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (Math.abs(value) >= 1_000_000) {
    const n = value / 1_000_000
    return `$${n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}M`
  }
  if (Math.abs(value) >= 100_000) return formatMoney(value)
  if (Math.abs(value) >= 1_000) {
    const n = value / 1_000
    return `$${n.toFixed(1).replace(/\.0$/, '')}K`
  }
  return formatMoney(value)
}

export function formatRange(low: number, high: number, compact = true): string {
  const fmt = compact ? formatCompact : formatMoney
  return `${fmt(low)}–${fmt(high)}`
}

export function formatSignedDays(value: number): string {
  const rounded = Math.round(value)
  return `${rounded > 0 ? '+' : ''}${rounded}d`
}

export function formatPct(value: number, digits = 1): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}%`
}
