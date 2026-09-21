import { formatCompact, formatDate, formatMoney, formatPct } from '@/lib/format'
import type { Invalidation, Quote } from '@/lib/types'
import { ANCHOR, type Study } from '@/lib/study'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type Props = {
  study: Study
  invalidation: Invalidation
  price: number
  now: number
  quote: Quote | null
  lastWeekly: number
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-[#0f141c] p-4">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 font-mono text-lg text-foreground tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-[0.75rem] text-muted">{hint}</p> : null}
    </div>
  )
}

export function FalsificationPanel({ study, invalidation, price, quote, lastWeekly }: Props) {
  const dropHigh = invalidation.requiredDropHigh
  const dropLow = invalidation.requiredDropLow
  const days = invalidation.daysLeft
  const env = invalidation.envelopePercentile
  const analogMax = invalidation.analogRemainingMax
  const weeklyVsSpot = quote ? formatPct((quote.price / lastWeekly - 1) * 100) : null

  return (
    <Card className="mb-6">
      <CardHeader>
        <p className="font-mono text-[0.75rem] tracking-[0.08em] text-muted">FALSIFICATION</p>
        <CardTitle>Can this path still hit the working range?</CardTitle>
        <CardDescription>
          Required move vs days left, spot versus the imported envelope, and remaining analog drawdown. This is a
          decision check, not a trade signal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert
          variant={
            invalidation.status === 'invalidated'
              ? 'destructive'
              : invalidation.status === 'stressed'
                ? 'warning'
                : 'default'
          }
        >
          <AlertTitle>{invalidation.title}</AlertTitle>
          <AlertDescription>{invalidation.detail}</AlertDescription>
        </Alert>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Days left in modeled bear"
            value={days === null ? '—' : `${Math.max(days, 0).toLocaleString('en-US')}`}
            hint={`Clock date ${formatDate(study.targets.bottom.date)}`}
          />
          <Stat
            label="Drop to top of bottom range"
            value={dropHigh === null ? '—' : `${(dropHigh * 100).toFixed(1)}% down`}
            hint={`From ${formatMoney(price)} to ${formatMoney(study.targets.bottom.high)}`}
          />
          <Stat
            label="Drop to range floor"
            value={dropLow === null ? '—' : `${(dropLow * 100).toFixed(1)}% down`}
            hint={`Floor ${formatMoney(study.targets.bottom.low)} · peak was ${formatCompact(ANCHOR.price)}`}
          />
          <Stat
            label="Spot vs envelope"
            value={
              env === null
                ? '—'
                : invalidation.spotVsEnvelope === 'above'
                  ? `Above max (${env.toFixed(0)}th)`
                  : invalidation.spotVsEnvelope === 'below'
                    ? 'Below min'
                    : `${env.toFixed(0)}th pct`
            }
            hint={
              analogMax === null
                ? 'Analog remaining n/a'
                : `Max analog remaining drop from this day-count: ${(analogMax * 100).toFixed(0)}%`
            }
          />
        </div>
        {weeklyVsSpot ? (
          <p className="text-[0.8125rem] text-muted">
            Last Tuesday close {formatMoney(lastWeekly)} vs live {formatMoney(quote!.price)} ({weeklyVsSpot} this week, not
            a weekly close).
          </p>
        ) : (
          <p className="text-[0.8125rem] text-muted">
            Live quote is off. Decision numbers use the last Tuesday close of {formatMoney(lastWeekly)}.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
