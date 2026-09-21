import { useMemo } from 'react'
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Checkbox } from '@/components/ui/checkbox'
import { computeYDomain } from '@/lib/chart-model'
import { DAY, toTime } from '@/lib/dates'
import { formatCompact, formatDate, formatDateTime, formatMoney } from '@/lib/format'
import {
  analogForwardPaths,
  ANCHOR,
  envelopeFromOrigin,
  EVENTS,
  nearestWeekly,
  OUTER_2013_BEAR_EXTRA,
  projectionOrigin,
  workingModelPath,
  type Study,
} from '@/lib/study'
import type { AnalogId, LegendKey, LegendState, Quote, ScaleId } from '@/lib/types'
import { cn } from '@/lib/utils'

type ChartRow = {
  t: number
  a2015?: number
  a2018?: number
  a2022?: number
  fanMin?: number
  fanMax?: number
  envMin?: number
  envMax?: number
  envAvg?: number
  model?: number
  modelLow?: number
  modelHigh?: number
}

type Props = {
  study: Study
  start: number
  end: number
  scale: ScaleId
  now: number
  quote: Quote | null
  hasProjection: boolean
  legend: LegendState
  onToggle: (key: LegendKey, value: boolean) => void
  heading: string
  caption: string
  note: string
  error: string | null
}

const ANALOG_KEYS: { id: AnalogId; key: 'a2015' | 'a2018' | 'a2022'; legend: LegendKey }[] = [
  { id: '2015', key: 'a2015', legend: 'analog2015' },
  { id: '2018', key: 'a2018', legend: 'analog2018' },
  { id: '2022', key: 'a2022', legend: 'analog2022' },
]

function dateTicks(start: number, end: number): number[] {
  const years = (end - start) / DAY / 365.25
  const monthStep = years > 10 ? 24 : years > 3 ? 12 : 3
  const ticks: number[] = []
  const cursor = new Date(start)
  cursor.setUTCDate(1)
  cursor.setUTCHours(0, 0, 0, 0)
  cursor.setUTCMonth(Math.floor(cursor.getUTCMonth() / monthStep) * monthStep)
  while (cursor.getTime() <= end) {
    if (cursor.getTime() >= start) ticks.push(cursor.getTime())
    cursor.setUTCMonth(cursor.getUTCMonth() + monthStep)
  }
  return ticks
}

function formatTick(value: number, start: number, end: number): string {
  const years = (end - start) / DAY / 365.25
  const date = new Date(value)
  if (years > 3) return String(date.getUTCFullYear())
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(date)
}

function ChartTooltip({
  active,
  payload,
  quote,
}: {
  active?: boolean
  payload?: { name?: string; value?: number; color?: string; dataKey?: string | number; payload?: ChartRow }[]
  quote: Quote | null
}) {
  if (!active || !payload?.length) return null
  const isQuote = payload.some((item) => item.dataKey === 'spot')
  const row = payload[0]?.payload as (ChartRow & { eventPrint?: number; name?: string; actual?: number }) | undefined
  if (!row) return null
  const title = isQuote && quote ? formatDateTime(quote.timestamp) : formatDate(row.t)
  const items = payload.filter((item) => Number.isFinite(item.value))
  return (
    <div className="rounded-md border border-[#43516a] bg-[#1b2431] px-3 py-2 text-[13px] text-[#c8d3e1] shadow">
      <p className="mb-1 text-[#edf2f8]">{title}</p>
      {row.name ? <p className="mb-1 text-[#edf2f8]">{row.name}</p> : null}
      {items.map((item) => (
        <p key={String(item.dataKey)} style={{ color: item.color }}>
          {item.name}: {formatMoney(Number(item.value))}
        </p>
      ))}
      {row.eventPrint ? <p>Event print: {formatMoney(row.eventPrint)}</p> : null}
    </div>
  )
}

export function CycleChart({
  study,
  start,
  end,
  scale,
  now,
  quote,
  hasProjection,
  legend,
  onToggle,
  heading,
  caption,
  note,
  error,
}: Props) {
  const lastWeeklyT = toTime(study.latestWeekly.d)

  const { actualSeries, rows, yMin, yMax, events, phases, quotePoint, lastPoint, modelSeries, origin } = useMemo(() => {
    const origin = projectionOrigin(study, now, quote)
    const inWindow = (t: number) => t >= start && t <= end
    const map = new Map<number, ChartRow>()
    const ensure = (t: number) => {
      let row = map.get(t)
      if (!row) {
        row = { t }
        map.set(t, row)
      }
      return row
    }

    const actualSeries = study.data.prices
      .filter((row) => inWindow(toTime(row.d)))
      .map((row) => ({ t: toTime(row.d), actual: row.c }))
    if (quote && inWindow(quote.timestamp) && quote.timestamp > lastWeeklyT) {
      actualSeries.push({ t: quote.timestamp, actual: quote.price })
    }

    const needForwards = hasProjection && (legend.analog2015 || legend.analog2018 || legend.analog2022 || legend.fan)
    const forwards = needForwards ? analogForwardPaths(study, origin.t, origin.price) : []

    if (hasProjection) {
      for (const path of forwards) {
        const slot = ANALOG_KEYS.find((item) => item.id === path.id)!
        if (!legend[slot.legend]) continue
        for (const point of path.points) {
          const t = point.t ?? toTime(point.date)
          if (t < origin.t - 60_000 || !inWindow(t)) continue
          ensure(t)[slot.key] = point.price
        }
      }

      if (legend.fan) {
        const times = new Set<number>()
        for (const path of forwards) {
          for (const point of path.points) times.add(point.t ?? toTime(point.date))
        }
        for (const t of times) {
          if (t < origin.t - 1000 || !inWindow(t)) continue
          const values: number[] = []
          for (const path of forwards) {
            const match = path.points.reduce(
              (best, point) => {
                const delta = Math.abs((point.t ?? toTime(point.date)) - t)
                return delta < best.delta ? { price: point.price, delta } : best
              },
              { price: Number.NaN, delta: Infinity },
            )
            if (match.delta < DAY * 4 && Number.isFinite(match.price)) values.push(match.price)
          }
          if (values.length) {
            const next = ensure(t)
            next.fanMin = Math.min(...values)
            next.fanMax = Math.max(...values)
          }
        }
      }

      if (legend.envMin || legend.envAvg || legend.envMax) {
        for (const row of envelopeFromOrigin(study, origin)) {
          if (row.x < origin.t - 1000 || !inWindow(row.x)) continue
          const next = ensure(row.x)
          if (legend.envMin) next.envMin = row.min
          if (legend.envMax) next.envMax = row.max
          if (legend.envAvg) next.envAvg = row.avg
        }
      }
    }

    const model = hasProjection && legend.classic ? workingModelPath(study, origin) : []
    const modelSeries = model.filter((row) => inWindow(row.t)).map((row) => ({ t: row.t, model: row.mid, modelLow: row.low, modelHigh: row.high }))
    for (const row of modelSeries) {
      const next = ensure(row.t)
      next.model = row.model
      next.modelLow = row.modelLow
      next.modelHigh = row.modelHigh
    }

    const rows = [...map.values()].sort((a, b) => a.t - b.t)
    const primary = actualSeries.map((row) => row.actual)
    if (quote && inWindow(quote.timestamp)) primary.push(quote.price)

    const events = EVENTS.map((event) => {
      const weekly = nearestWeekly(study.data.prices, event.date)
      return {
        ...event,
        x: toTime(event.date),
        weekly: weekly.c,
        weeklyDate: weekly.d,
        name: `${event.date.slice(0, 4)} ${event.type}${event.approximate ? '*' : ''}`,
      }
    }).filter((event) => inWindow(event.x))
    for (const event of events) primary.push(event.weekly)

    const extras: number[] = []
    for (const row of rows) {
      if (row.a2015) extras.push(row.a2015)
      if (row.a2018) extras.push(row.a2018)
      if (row.a2022) extras.push(row.a2022)
      if (row.fanMin) extras.push(row.fanMin)
      if (row.fanMax) extras.push(row.fanMax)
      if (row.envMin) extras.push(row.envMin)
      if (row.envAvg) extras.push(row.envAvg)
      if (row.envMax) extras.push(row.envMax)
      if (row.model) extras.push(row.model)
      if (row.modelLow) extras.push(row.modelLow)
      if (row.modelHigh) extras.push(row.modelHigh)
    }
    if (hasProjection && legend.classic) {
      extras.push(study.targets.bottom.low, study.targets.bottom.high, study.targets.top.low, study.targets.top.high)
    }

    const [yMin, yMax] = computeYDomain({ primary, extras, scale })

    const phases = study.intervals.map((row, i) => ({
      key: `h-${i}`,
      x1: toTime(row.from.date),
      x2: toTime(row.to.date),
      bear: row.phase === 'bear',
      projected: false,
    }))
    if (hasProjection) {
      phases.push({
        key: 'p-bear',
        x1: Math.max(origin.t, toTime(ANCHOR.date)),
        x2: toTime(study.targets.bottom.date),
        bear: true,
        projected: true,
      })
      phases.push({
        key: 'p-bull',
        x1: Math.max(origin.t, toTime(study.targets.bottom.date)),
        x2: toTime(study.targets.top.date),
        bear: false,
        projected: true,
      })
    }

    const quotePoint = quote && inWindow(quote.timestamp) ? { t: quote.timestamp, spot: quote.price } : null
    const lastPoint = inWindow(lastWeeklyT) ? { t: lastWeeklyT, lastWeekly: study.latestWeekly.c } : null

    return { actualSeries, rows, yMin, yMax, events, phases, quotePoint, lastPoint, modelSeries, origin }
  }, [study, start, end, scale, now, quote, hasProjection, legend, lastWeeklyT])

  const projectionOn =
    legend.analog2015 ||
    legend.analog2018 ||
    legend.analog2022 ||
    legend.envMin ||
    legend.envAvg ||
    legend.envMax ||
    legend.fan ||
    legend.classic ||
    legend.bands
  const busy =
    [
      legend.analog2015,
      legend.analog2018,
      legend.analog2022,
      legend.envMin,
      legend.envAvg,
      legend.envMax,
      legend.fan,
      legend.classic,
    ].filter(Boolean).length >= 5
  const lineOpacity = busy ? 0.62 : 0.95
  const bandOpacity = busy ? 0.08 : 0.16

  const bottomX = toTime(study.targets.bottom.date)
  const topX = toTime(study.targets.top.date)
  const innerPad = study.config.toleranceDays * DAY
  const outerLate = OUTER_2013_BEAR_EXTRA * DAY
  const analogById = Object.fromEntries(study.analogs.map((analog) => [analog.id, analog]))

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-4 p-6 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-[0.75rem] tracking-[0.08em] text-muted">PRICE &amp; TIMING</p>
          <h2 className="text-[1.28rem] font-semibold">{heading}</h2>
          <p className="mt-1 text-[0.8125rem] text-muted">{caption}</p>
        </div>
      </div>
      <div className="relative mx-3 h-[clamp(360px,42vw,530px)] sm:mx-5">
        {error ? (
          <p className="absolute inset-0 grid place-items-center rounded-lg border border-dashed border-border bg-card p-8 text-center text-muted">
            {error}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 18, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#a1b3cc10" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                domain={[start, end]}
                ticks={dateTicks(start, end)}
                tickFormatter={(value) => formatTick(Number(value), start, end)}
                tick={{ fill: '#9ca9ba', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                orientation="right"
                scale={scale === 'log' ? 'log' : 'auto'}
                domain={[yMin, yMax]}
                allowDataOverflow
                tickFormatter={(value) => formatCompact(Number(value))}
                tick={{ fill: '#9ca9ba', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={64}
              />
              <Tooltip content={<ChartTooltip quote={quote} />} />
              {legend.phases
                ? phases
                    .filter((phase) => phase.x1 < phase.x2 && Math.max(phase.x1, start) < Math.min(phase.x2, end))
                    .map((phase) => (
                      <ReferenceArea
                        key={phase.key}
                        x1={Math.max(phase.x1, start)}
                        x2={Math.min(phase.x2, end)}
                        fill={phase.bear ? '#ff8e9d' : '#6bd9ad'}
                        fillOpacity={0.05}
                        stroke={phase.projected ? '#b1bdd126' : 'none'}
                        strokeDasharray={phase.projected ? '4 5' : undefined}
                        ifOverflow="hidden"
                      />
                    ))
                : null}
              {hasProjection && legend.bands ? (
                <>
                  <ReferenceArea
                    x1={Math.max(bottomX - innerPad, origin.t, start)}
                    x2={Math.min(bottomX + outerLate, end)}
                    fill="#ff8e9d"
                    fillOpacity={0.04}
                    stroke="none"
                    ifOverflow="hidden"
                  />
                  <ReferenceArea
                    x1={Math.max(bottomX - innerPad, origin.t, start)}
                    x2={Math.min(bottomX + innerPad, end)}
                    fill="#ff8e9d"
                    fillOpacity={0.1}
                    stroke="none"
                    ifOverflow="hidden"
                  />
                  <ReferenceArea
                    x1={Math.max(topX - innerPad, origin.t, start)}
                    x2={Math.min(topX + innerPad, end)}
                    fill="#6bd9ad"
                    fillOpacity={0.08}
                    stroke="none"
                    ifOverflow="hidden"
                  />
                </>
              ) : null}
              {hasProjection && legend.fan ? (
                <>
                  <Line
                    type="monotone"
                    dataKey="fanMax"
                    name="From-today fan max"
                    stroke="#c9d6e8"
                    strokeWidth={8}
                    strokeOpacity={bandOpacity}
                    dot={false}
                    isAnimationActive={false}
                    connectNulls
                    legendType="none"
                  />
                  <Line
                    type="monotone"
                    dataKey="fanMin"
                    name="From-today fan min"
                    stroke="#c9d6e8"
                    strokeWidth={8}
                    strokeOpacity={bandOpacity}
                    dot={false}
                    isAnimationActive={false}
                    connectNulls
                    legendType="none"
                  />
                </>
              ) : null}
              <Line
                data={actualSeries}
                type="linear"
                dataKey="actual"
                name="BTC/USD actual"
                stroke="#ffac4b"
                strokeWidth={2.2}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
              {hasProjection && legend.envMin ? (
                <Line type="linear" dataKey="envMin" name="Envelope min" stroke="#8493a4" strokeWidth={1} strokeOpacity={lineOpacity} dot={false} isAnimationActive={false} connectNulls />
              ) : null}
              {hasProjection && legend.envMax ? (
                <Line type="linear" dataKey="envMax" name="Envelope max" stroke="#8493a4" strokeWidth={1} strokeOpacity={lineOpacity} dot={false} isAnimationActive={false} connectNulls />
              ) : null}
              {hasProjection && legend.envAvg ? (
                <Line type="linear" dataKey="envAvg" name="Envelope mean" stroke="#a9b5c7" strokeWidth={1.4} strokeDasharray="4 5" strokeOpacity={lineOpacity} dot={false} isAnimationActive={false} connectNulls />
              ) : null}
              {hasProjection
                ? ANALOG_KEYS.map((slot) =>
                    legend[slot.legend] ? (
                      <Line
                        key={slot.id}
                        type="linear"
                        dataKey={slot.key}
                        name={`${analogById[slot.id]?.label ?? slot.id} from today`}
                        stroke={analogById[slot.id]?.color ?? '#92b6ff'}
                        strokeWidth={1.6}
                        strokeOpacity={lineOpacity}
                        dot={false}
                        isAnimationActive={false}
                        connectNulls
                      />
                    ) : null,
                  )
                : null}
              {hasProjection && legend.classic ? (
                <Line
                  data={modelSeries}
                  type="linear"
                  dataKey="model"
                  name="Working model path"
                  stroke="#e8d7a3"
                  strokeWidth={1.7}
                  strokeDasharray="7 5"
                  strokeOpacity={lineOpacity}
                  dot={false}
                  isAnimationActive={false}
                />
              ) : null}
              {events.map((event) => (
                <ReferenceLine
                  key={`el-${event.date}`}
                  x={event.x}
                  stroke={event.type === 'top' ? '#6bd9ad55' : '#ff8e9d55'}
                  strokeDasharray="3 5"
                />
              ))}
              {hasProjection && legend.classic ? (
                <>
                  <ReferenceLine x={bottomX} stroke="#ff8e9d77" strokeDasharray="6 5" />
                  <ReferenceLine x={topX} stroke="#6bd9ad77" strokeDasharray="6 5" />
                  <ReferenceArea
                    x1={bottomX - DAY * 3}
                    x2={bottomX + DAY * 3}
                    y1={study.targets.bottom.low}
                    y2={study.targets.bottom.high}
                    fill="#ff8e9d"
                    fillOpacity={0.45}
                    stroke="none"
                    ifOverflow="hidden"
                  />
                  <ReferenceArea
                    x1={topX - DAY * 3}
                    x2={topX + DAY * 3}
                    y1={study.targets.top.low}
                    y2={study.targets.top.high}
                    fill="#6bd9ad"
                    fillOpacity={0.45}
                    stroke="none"
                    ifOverflow="hidden"
                  />
                </>
              ) : null}
              {now >= start && now <= end ? (
                <ReferenceLine
                  x={now}
                  stroke="#92b6ff99"
                  strokeDasharray="2 5"
                  label={{ value: 'Today', fill: '#92b6ff', position: 'insideTopLeft', fontSize: 12 }}
                />
              ) : null}
              <Scatter
                data={events.map((event) => ({ t: event.x, eventWeekly: event.weekly, eventPrint: event.price, name: event.name }))}
                dataKey="eventWeekly"
                name="Event (weekly close)"
                fill="#11161e"
                shape={(props) => {
                  const payload = props.payload as { eventPrint: number; name: string }
                  const top = payload.name.includes('top')
                  const color = top ? '#6bd9ad' : '#ff8e9d'
                  const cx = Number(props.cx)
                  const cy = Number(props.cy)
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r={3.5} fill={color} stroke="#11161e" strokeWidth={1.5} />
                      <text
                        x={cx}
                        y={top ? cy - 10 : cy + 16}
                        textAnchor="middle"
                        fill={color}
                        fontSize={11}
                        fontFamily="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
                      >
                        {payload.name}
                      </text>
                    </g>
                  )
                }}
                isAnimationActive={false}
              />
              {lastPoint ? (
                <Scatter
                  data={[lastPoint]}
                  dataKey="lastWeekly"
                  name="Last weekly close"
                  fill="#ffac4b"
                  stroke="#11161e"
                  r={4}
                  isAnimationActive={false}
                />
              ) : null}
              {quotePoint ? (
                <Scatter
                  data={[quotePoint]}
                  dataKey="spot"
                  name="Live quote"
                  fill="#92b6ff"
                  stroke="#11161e"
                  r={5}
                  isAnimationActive={false}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 px-6 py-4 text-[0.8125rem] text-[#bfcbda]">
        <span className="inline-flex items-center gap-2">
          <i className="inline-block h-0.5 w-5 bg-primary" /> Actual BTC/USD
        </span>
        <span className="inline-flex items-center gap-2">
          <i className="size-1.5 rounded-full bg-quote" /> Live quote
        </span>
        <span className="inline-flex items-center gap-2">
          <i className="size-1.5 rounded-full bg-bull" /> Cycle top
        </span>
        <span className="inline-flex items-center gap-2">
          <i className="size-1.5 rounded-full bg-bear" /> Cycle bottom
        </span>
        <LegendToggle checked={legend.phases} onChange={(value) => onToggle('phases', value)} label="Phase shading" />
        <LegendToggle
          checked={legend.analog2015}
          onChange={(value) => onToggle('analog2015', value)}
          label="2015 analog"
          disabled={!hasProjection}
          series="analog2015"
        />
        <LegendToggle
          checked={legend.analog2018}
          onChange={(value) => onToggle('analog2018', value)}
          label="2018 analog"
          disabled={!hasProjection}
          series="analog2018"
        />
        <LegendToggle
          checked={legend.analog2022}
          onChange={(value) => onToggle('analog2022', value)}
          label="2022 analog"
          disabled={!hasProjection}
          series="analog2022"
        />
        <LegendToggle
          checked={legend.envMin}
          onChange={(value) => onToggle('envMin', value)}
          label="Envelope min"
          disabled={!hasProjection}
          series="envMin"
        />
        <LegendToggle
          checked={legend.envAvg}
          onChange={(value) => onToggle('envAvg', value)}
          label="Envelope mean"
          disabled={!hasProjection}
          series="envAvg"
        />
        <LegendToggle
          checked={legend.envMax}
          onChange={(value) => onToggle('envMax', value)}
          label="Envelope max"
          disabled={!hasProjection}
          series="envMax"
        />
        <LegendToggle
          checked={legend.fan}
          onChange={(value) => onToggle('fan', value)}
          label="From-today fan"
          disabled={!hasProjection}
          series="fan"
        />
        <LegendToggle
          checked={legend.classic}
          onChange={(value) => onToggle('classic', value)}
          label="Working model path"
          disabled={!hasProjection}
          series="classic"
        />
        <LegendToggle
          checked={legend.bands}
          onChange={(value) => onToggle('bands', value)}
          label="Date uncertainty"
          disabled={!hasProjection}
          series="bands"
        />
      </div>
      <div className="flex items-start gap-2.5 border-t border-border bg-[#0f141c] px-6 py-3.5 text-[0.8125rem] text-muted">
        <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-[#66758a] text-[0.7rem]">
          i
        </span>
        <p>
          {note} Event dots sit on the weekly close; tooltips also report the original event print (2017 top{' '}
          {formatMoney(20089)} vs weekly {formatMoney(nearestWeekly(study.data.prices, '2017-12-17').c)}). Inner date band
          ±{study.config.toleranceDays}d; outer late band +{OUTER_2013_BEAR_EXTRA}d (2013-style). Last weekly{' '}
          {formatDate(study.latestWeekly.d)} {formatMoney(study.latestWeekly.c)}
          {quote ? ` · live ${formatDateTime(quote.timestamp)} ${formatMoney(quote.price)}` : '.'} Projections are rebased
          to {origin.source === 'live' ? 'the live print' : 'the last weekly close'} on {formatDate(origin.t)} and stay
          {projectionOn ? ' on only for the series you enabled' : ' off until you toggle them'}
          .
        </p>
      </div>
    </section>
  )
}

function LegendToggle({
  checked,
  onChange,
  label,
  disabled,
  series,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  disabled?: boolean
  series?: string
}) {
  return (
    <label
      className={cn('inline-flex min-h-8 cursor-pointer items-center gap-2 text-sm', disabled && 'cursor-default opacity-50')}
      data-legend={series ?? label}
    >
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={(value) => onChange(value === true)} />
      {label}
    </label>
  )
}
