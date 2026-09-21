import { isoDate } from '@/lib/dates'
import type { PricePoint, Quote, QuoteError } from '@/lib/types'

const QUOTE_MAX_AGE_MS = 15 * 60 * 1000
const QUOTE_FUTURE_MS = 60 * 1000

/** Overwrite embedded weeklies from the study peak onward with public-API actuals. */
export const HISTORY_REPLACE_FROM = '2025-10-06'

export const COINGECKO_RANGE_ENDPOINT = 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range'

export function isFileProtocol(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'file:'
}

/** Vite proxy on http(s); direct CoinGecko on file:// so the single HTML still tries a live quote. */
export function coingeckoUrl(pathAndQuery: string): string {
  const path = pathAndQuery.replace(/^\//, '')
  if (isFileProtocol()) return `https://api.coingecko.com/api/v3/${path}`
  return `/api/coingecko/${path}`
}

export function weeklyHistoryUrl(now = Date.now()): string {
  const from = Math.floor(Date.parse(`${HISTORY_REPLACE_FROM}T00:00:00Z`) / 1000)
  const to = Math.floor(now / 1000)
  return coingeckoUrl(`coins/bitcoin/market_chart/range?vs_currency=usd&from=${from}&to=${to}`)
}

export function quoteUrl(): string {
  return coingeckoUrl('simple/price?ids=bitcoin&vs_currencies=usd&include_last_updated_at=true')
}

export function classifyFetchError(error: unknown): QuoteError {
  const message = error instanceof Error ? error.message : String(error)
  const name = error instanceof Error ? error.name : ''
  if (name === 'AbortError' || /aborted|timeout/i.test(message)) {
    return { kind: 'abort', message: 'Quote request timed out (10s).' }
  }
  if (/failed to fetch|networkerror|load failed|cors/i.test(message)) {
    return {
      kind: 'cors',
      message: isFileProtocol()
        ? 'Network/CORS blocked CoinGecko from this file:// page. Embedded weekly history is still shown. Serve over http (npm run dev) or allow api.coingecko.com.'
        : 'Network/CORS blocked the CoinGecko request. Use the Vite dev server so /api/coingecko can proxy.',
    }
  }
  return { kind: 'network', message }
}

export function parseQuote(payload: unknown, fetchedAt: number, source = 'CoinGecko'): Quote {
  const bitcoin = (payload as { bitcoin?: { usd?: unknown; last_updated_at?: unknown } } | null)?.bitcoin
  const price = Number(bitcoin?.usd)
  const seconds = Number(bitcoin?.last_updated_at)
  const timestamp = seconds * 1000
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(timestamp)) {
    throw Object.assign(new Error('The price provider returned an invalid quote.'), { kind: 'invalid' })
  }
  if (timestamp > fetchedAt + QUOTE_FUTURE_MS) {
    throw Object.assign(new Error('The quote timestamp is in the future.'), { kind: 'future' })
  }
  if (fetchedAt - timestamp > QUOTE_MAX_AGE_MS) {
    throw Object.assign(new Error('The price provider returned a stale quote (>15 minutes).'), { kind: 'stale' })
  }
  return { price, timestamp, fetchedAt, source }
}

export async function fetchQuote(timeoutMs = 10_000): Promise<Quote> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(quoteUrl(), { signal: controller.signal, cache: 'no-store', credentials: 'omit' })
    if (!response.ok) {
      throw Object.assign(new Error(`Quote request failed (HTTP ${response.status}).`), { kind: 'http' })
    }
    return parseQuote(await response.json(), Date.now())
  } catch (error) {
    const tagged = error as QuoteError & Error
    if (tagged.kind) throw tagged
    throw Object.assign(new Error(classifyFetchError(error).message), classifyFetchError(error))
  } finally {
    clearTimeout(timer)
  }
}

export function dailyToTuesdays(series: [number, number][]): PricePoint[] {
  const byDate = new Map<string, number>()
  for (const [ts, price] of series) {
    if (!Number.isFinite(ts) || !Number.isFinite(price) || price <= 0) continue
    byDate.set(isoDate(ts), price)
  }
  const dates = [...byDate.keys()].sort()
  if (dates.length === 0) return []
  const points: PricePoint[] = []
  for (const d of dates) {
    const utc = new Date(`${d}T00:00:00Z`)
    if (utc.getUTCDay() === 2) {
      points.push({ d, c: Math.round(byDate.get(d)! * 100) / 100 })
    }
  }
  return points
}

async function fetchPrices(url: string, timeoutMs: number): Promise<[number, number][]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store', credentials: 'omit' })
    if (!response.ok) {
      throw Object.assign(new Error(`Weekly history request failed (HTTP ${response.status}).`), { kind: 'http' })
    }
    const payload = (await response.json()) as { prices?: [number, number][] }
    if (!Array.isArray(payload.prices) || payload.prices.length < 2) {
      throw Object.assign(new Error('Weekly history payload was empty or malformed.'), { kind: 'parse' })
    }
    return payload.prices
  } catch (error) {
    const tagged = error as QuoteError & Error
    if (tagged.kind) throw tagged
    throw Object.assign(new Error(classifyFetchError(error).message), classifyFetchError(error))
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchWeeklyHistory(timeoutMs = 15_000, now = Date.now()): Promise<PricePoint[]> {
  let prices: [number, number][]
  try {
    prices = await fetchPrices(weeklyHistoryUrl(now), timeoutMs)
  } catch (error) {
    const tagged = error as QuoteError & Error
    if (tagged.kind === 'http') {
      prices = await fetchPrices(coingeckoUrl('coins/bitcoin/market_chart?vs_currency=usd&days=365&interval=daily'), timeoutMs)
    } else {
      throw error
    }
  }
  const tuesdays = dailyToTuesdays(prices)
  if (tuesdays.length < 2) {
    throw Object.assign(new Error('Could not resample CoinGecko daily prints onto Tuesdays.'), { kind: 'parse' })
  }
  return tuesdays
}

/** Replace base weeklies on/after replaceFrom with incoming public-API prints. */
export function mergeWeekly(base: PricePoint[], incoming: PricePoint[], replaceFrom: string): PricePoint[] {
  const byDate = new Map(base.map((row) => [row.d, row]))
  for (const row of incoming) {
    if (row.d >= replaceFrom) {
      byDate.set(row.d, row)
    }
  }
  return [...byDate.values()].sort((a, b) => a.d.localeCompare(b.d))
}
