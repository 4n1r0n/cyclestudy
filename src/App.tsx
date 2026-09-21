import { useCallback, useEffect, useMemo, useState } from 'react'
import cycleJson from '@/data/cycle-data.json'
import { ComparisonTable } from '@/components/ComparisonTable'
import { CycleChart } from '@/components/CycleChart'
import { FalsificationPanel } from '@/components/FalsificationPanel'
import { Methodology } from '@/components/Methodology'
import { MetricCards } from '@/components/MetricCards'
import { SensitivityPanel } from '@/components/SensitivityPanel'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { toTime } from '@/lib/dates'
import { formatDate, formatDateTime, formatMoney } from '@/lib/format'
import { fetchQuote, fetchWeeklyHistory, HISTORY_REPLACE_FROM, mergeWeekly } from '@/lib/market'
import {
  analogWorkingConfig,
  buildAnalogs,
  buildInvalidation,
  CLASSIC_CONFIG,
  createStudy,
  phaseAt,
  quoteIsFresh,
  windowBounds,
  windowHasProjection,
} from '@/lib/study'
import type {
  CycleData,
  DisplayedPrice,
  LegendKey,
  LegendState,
  ProjectionMode,
  Quote,
  QuoteError,
  ScaleId,
  WindowId,
  WorkingConfig,
} from '@/lib/types'
import { DEFAULT_LEGEND } from '@/lib/types'
import { cn } from '@/lib/utils'

const WINDOWS: { id: WindowId; label: string }[] = [
  { id: 'all', label: 'All cycles' },
  { id: '2013-2017', label: '2013–2017' },
  { id: '2017-2021', label: '2017–2021' },
  { id: '2021-2025', label: '2021–2025' },
  { id: '2025-2029', label: '2025–2029' },
]

const seed = cycleJson as CycleData

function analogDefaultsFrom(data: CycleData): WorkingConfig {
  return analogWorkingConfig(buildAnalogs(data.prices))
}

export default function App() {
  const [data, setData] = useState<CycleData>(seed)
  const [mode, setMode] = useState<ProjectionMode>('analog')
  const [config, setConfig] = useState<WorkingConfig>(() => analogDefaultsFrom(seed))
  const [windowId, setWindowId] = useState<WindowId>('all')
  const [scale, setScale] = useState<ScaleId>('log')
  const [legend, setLegend] = useState<LegendState>(DEFAULT_LEGEND)
  const [now, setNow] = useState(() => Date.now())
  const [liveEnabled, setLiveEnabled] = useState(true)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteError, setQuoteError] = useState<QuoteError | null>(null)
  const [weeklyError, setWeeklyError] = useState<string | null>(null)
  const [fetchingQuote, setFetchingQuote] = useState(false)
  const [fetchingWeekly, setFetchingWeekly] = useState(false)
  const [weeklyFetchedAt, setWeeklyFetchedAt] = useState<number | null>(null)

  const built = useMemo(() => {
    try {
      return { study: createStudy(data, config, mode), error: null as string | null }
    } catch (error) {
      return { study: null, error: error instanceof Error ? error.message : 'The study could not be constructed.' }
    }
  }, [data, config, mode])

  const study = built.study
  const live = quoteIsFresh(quote, now)
  const displayed: DisplayedPrice | null = study
    ? live && quote
      ? {
          value: quote.price,
          kind: 'live',
          asOf: quote.timestamp,
          label: formatDateTime(quote.timestamp),
          snapshot: false,
        }
      : {
          value: study.latestWeekly.c,
          kind: 'weekly',
          asOf: toTime(study.latestWeekly.d),
          label: `${formatDate(study.latestWeekly.d)} · last Tuesday close`,
          snapshot: true,
        }
    : null

  const handleMode = (next: ProjectionMode) => {
    setMode(next)
    setConfig(next === 'analog' ? analogDefaultsFrom(data) : CLASSIC_CONFIG)
  }

  const refreshLive = useCallback(async () => {
    setFetchingQuote(true)
    setFetchingWeekly(true)
    try {
      const nextQuote = await fetchQuote()
      setQuote(nextQuote)
      setQuoteError(null)
    } catch (error) {
      const err = error as QuoteError
      setQuoteError({ kind: err.kind ?? 'network', message: err.message ?? 'Quote refresh failed.' })
    } finally {
      setFetchingQuote(false)
    }
    try {
      const incoming = await fetchWeeklyHistory()
      const merged = mergeWeekly(seed.prices, incoming, HISTORY_REPLACE_FROM)
      setData({
        ...seed,
        prices: merged,
        source: {
          ...seed.source,
          historyThrough: merged.at(-1)?.d ?? seed.source.historyThrough,
        },
      })
      setWeeklyError(null)
      setWeeklyFetchedAt(Date.now())
    } catch (error) {
      const err = error as QuoteError
      setWeeklyError(err.message ?? 'Weekly history refresh failed. Embedded series is still shown.')
    } finally {
      setFetchingWeekly(false)
    }
  }, [])

  const enableLive = () => {
    setLiveEnabled(true)
    void refreshLive()
  }

  useEffect(() => {
    void refreshLive()
  }, [refreshLive])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) setNow(Date.now())
    }, 60_000)
    const onVis = () => {
      if (!document.hidden) setNow(Date.now())
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  useEffect(() => {
    if (!liveEnabled) return
    const timer = window.setInterval(() => {
      if (!document.hidden) void refreshLive()
    }, 5 * 60 * 1000)
    const onVis = () => {
      if (!document.hidden) void refreshLive()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [liveEnabled, refreshLive])

  const quoteStatus = fetchingQuote && !quote
    ? { className: '', text: 'Loading CoinGecko quote…' }
    : quoteError && live
      ? { className: 'live', text: `Last quote retained · ${quoteError.message}` }
      : quoteError
        ? { className: 'snapshot', text: quoteError.message }
        : live
          ? { className: 'live', text: 'Latest quote · CoinGecko' }
          : { className: 'snapshot', text: 'Quote unavailable · last weekly close' }

  const chartNoteError = [quoteError && liveEnabled ? `Quote: ${quoteError.message}` : null, weeklyError]
    .filter(Boolean)
    .join(' ')

  if (!study || !displayed) {
    return (
      <div className="mx-auto max-w-[1536px] px-4 py-16 sm:px-10">
        <h1 className="text-2xl font-semibold">Bitcoin Cycle Study</h1>
        <p className="mt-4 text-bear" role="alert">
          {built.error ?? 'The study could not be constructed from the embedded data.'}
        </p>
      </div>
    )
  }

  const phase = phaseAt(study, now)
  const invalidation = buildInvalidation(study, now, displayed.value)
  const [winStart, winEnd] = windowBounds(windowId, study.latestWeekly.d, study.targets.bottom.date, now)
  const hasProjection = windowHasProjection(winStart, winEnd, study.targets.top.date)
  const heading = windowId === 'all' ? 'Cycle overview' : `${windowId.replace('-', '–')} cycle`
  const note = hasProjection
    ? 'Orange is actual Tuesday closes (CoinGecko from the Oct 2025 peak) plus today’s live print. Analog, envelope, fan, and model paths start at that print and run forward only — they are off until toggled in the legend.'
    : 'Cycle markers use event dates; dots sit on the weekly close, not the original event extreme.'

  return (
    <TooltipProvider>
      <a className="absolute top-[-100px] left-4 z-30 rounded-md border border-primary bg-card px-3 py-2 focus:top-4" href="#study">
        Skip to study
      </a>
      <header className="mx-auto flex min-h-[118px] max-w-[1536px] items-center justify-between gap-6 border-b border-border px-4 py-4 sm:px-10">
        <div className="flex items-center gap-4">
          <span
            className="grid size-12 shrink-0 rotate-12 place-items-center rounded-full border border-[#75502b] bg-[#241c14] text-3xl text-primary"
            aria-hidden="true"
          >
            ₿
          </span>
          <div>
            <p className="mb-1 font-mono text-xs tracking-[0.08em] text-muted">
              BTC / USD <span className="px-2 text-[#637083]">/</span> CYCLE RESEARCH
            </p>
            <h1 className="text-[1.7rem] leading-tight font-semibold tracking-tight">Bitcoin Cycle Study</h1>
          </div>
        </div>
        <div className="flex max-w-[220px] flex-col items-end gap-1 text-right text-xs text-muted sm:max-w-none">
          <span className="hidden font-mono text-foreground sm:inline">@filipcourtois</span>
          <span>
            Price as of {displayed.kind === 'live' ? formatDateTime(displayed.asOf) : `${formatDate(displayed.asOf)} · weekly`}
          </span>
          <span>Page clock {formatDate(now)} UTC</span>
        </div>
      </header>

      <main id="study" className="mx-auto max-w-[1536px] px-4 pt-7 pb-8 sm:px-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <p>
            {mode === 'analog' ? 'Analog-calibrated' : 'Classic 364 / 1,064'} timing
            <span className="mx-2 text-[#64758c]" aria-hidden="true">
              /
            </span>
            weekly BTC/USD
          </p>
          <span
            className={cn(
              'inline-flex items-center gap-2 text-[0.8rem] before:size-1.5 before:rounded-full before:bg-muted',
              quoteStatus.className === 'live' && 'text-bull before:bg-bull before:shadow-[0_0_0_3px_#6bd9ad12]',
              quoteStatus.className === 'snapshot' && 'text-[#d4b78d] before:bg-[#d4b78d]',
            )}
            role="status"
            aria-live="polite"
          >
            {quoteStatus.text}
          </span>
        </div>

        <MetricCards
          price={displayed}
          study={study}
          phase={phase}
          now={now}
          lastWeeklyLabel={`Last weekly ${formatDate(study.latestWeekly.d)} ${formatMoney(study.latestWeekly.c)}`}
        />

        <FalsificationPanel
          study={study}
          invalidation={invalidation}
          price={displayed.value}
          now={now}
          quote={live ? quote : null}
          lastWeekly={study.latestWeekly.c}
        />

        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-[#0d1219] p-1">
            {WINDOWS.map((item) => (
              <button
                key={item.id}
                type="button"
                data-window={item.id}
                aria-pressed={windowId === item.id}
                onClick={() => setWindowId(item.id)}
                className={cn(
                  'min-h-[38px] rounded-md px-3 py-2 text-sm text-muted hover:bg-accent hover:text-foreground',
                  windowId === item.id && 'border border-[#384659] bg-[#283341] text-foreground',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex gap-1 rounded-lg border border-border bg-[#0d1219] p-1" role="group" aria-label="Price scale">
              {(['log', 'linear'] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  data-scale={id}
                  aria-pressed={scale === id}
                  onClick={() => setScale(id)}
                  className={cn(
                    'min-h-[38px] rounded-md px-3 py-2 text-sm text-muted hover:bg-accent hover:text-foreground',
                    scale === id && 'bg-primary font-semibold text-primary-foreground',
                  )}
                >
                  {id === 'log' ? 'Logarithmic' : 'Linear'}
                </button>
              ))}
            </div>
            {liveEnabled ? (
              <Button variant="ghost" onClick={() => void refreshLive()} disabled={fetchingQuote || fetchingWeekly}>
                <span aria-hidden="true">↻</span> Refresh quote &amp; weekly
              </Button>
            ) : (
              <Button onClick={enableLive}>Load live quote &amp; weekly</Button>
            )}
          </div>
        </div>

        <CycleChart
          study={study}
          start={toTime(winStart)}
          end={toTime(winEnd)}
          scale={scale}
          now={now}
          quote={live ? quote : null}
          hasProjection={hasProjection}
          legend={legend}
          onToggle={(key: LegendKey, value) => setLegend((current) => ({ ...current, [key]: value }))}
          heading={heading}
          caption={`Actual BTC/USD · CoinGecko Tuesdays through ${formatDate(study.latestWeekly.d)}${weeklyFetchedAt ? ` · refreshed ${formatDateTime(weeklyFetchedAt)}` : ' · embedded CoinGecko actuals from Oct 2025'}`}
          note={chartNoteError ? `${chartNoteError} ${note}` : note}
          error={built.error}
        />

        <SensitivityPanel study={study} mode={mode} config={config} onMode={handleMode} onChange={setConfig} />
        <ComparisonTable study={study} />
        <Methodology study={study} />
      </main>
      <footer className="mx-auto flex max-w-[1536px] flex-wrap justify-between gap-2 px-4 pb-8 text-xs text-muted sm:px-10">
        <span>
          CycleStudy <span className="px-1">·</span> @filipcourtois
        </span>
        <span>
          Tuesday weekly · CoinGecko actuals from Oct 2025 <span className="px-1">·</span> USD / UTC
        </span>
      </footer>
    </TooltipProvider>
  )
}
