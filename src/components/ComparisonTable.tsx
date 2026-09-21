import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate, formatSignedDays } from '@/lib/format'
import type { Study } from '@/lib/study'
import { cn } from '@/lib/utils'

type Props = { study: Study }

export function ComparisonTable({ study }: Props) {
  return (
    <Card className="mb-6 overflow-hidden">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-[0.75rem] tracking-[0.08em] text-muted">HISTORICAL COMPARISON</p>
          <CardTitle>How closely did the timing fit?</CardTitle>
          <CardDescription>
            Headline MAE excludes the approximate 2013 weekly anchor and the 2022–2025 bull that ends on the same peak
            used to project. Fit is not out-of-sample forecast skill.
          </CardDescription>
        </div>
        <div className="text-left sm:text-right">
          <p className="font-semibold text-primary text-[1.7rem] leading-none">{study.honestMae.toFixed(1)} days</p>
          <p className="text-[0.8125rem] text-muted">honest mean absolute timing error</p>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Historical timing comparison">
          <table className="w-full border-collapse text-left text-sm whitespace-nowrap">
            <caption className="sr-only">
              Actual cycle durations compared with the working bear/bull length. The 2013 top is an approximate weekly
              anchor. The 2022–2025 bull ends on the projection peak and is excluded from headline MAE.
            </caption>
            <thead>
              <tr className="border-y border-border bg-[#141b25] text-[0.8125rem] font-medium text-muted">
                <th className="px-4 py-3 pl-6" scope="col">
                  Phase
                </th>
                <th className="px-4 py-3" scope="col">
                  From
                </th>
                <th className="px-4 py-3" scope="col">
                  To
                </th>
                <th className="px-4 py-3 text-right" scope="col">
                  Actual
                </th>
                <th className="px-4 py-3 text-right" scope="col">
                  Model
                </th>
                <th className="px-4 py-3 text-right" scope="col">
                  Difference
                </th>
                <th className="px-4 py-3 pr-6" scope="col">
                  Within ±{study.config.toleranceDays}d
                </th>
              </tr>
            </thead>
            <tbody>
              {study.intervals.map((row) => {
                const within = Math.abs(row.difference) <= study.config.toleranceDays
                return (
                  <tr key={`${row.from.date}-${row.to.date}`} className="border-b border-[#202936] last:border-0 hover:bg-[#171e28]">
                    <td className="px-4 py-3 pl-6">
                      <span className="inline-flex items-center gap-2">
                        <span className={cn('size-1.5 rounded-full', row.phase === 'bear' ? 'bg-bear' : 'bg-bull')} />
                        {row.phase === 'bear' ? 'Bear' : 'Bull'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {formatDate(row.from.date)}
                      {row.from.approximate ? <span className="text-primary">*</span> : null}
                    </td>
                    <td className="px-4 py-3">{formatDate(row.to.date)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{row.actual.toLocaleString('en-US')}d</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{row.expected.toLocaleString('en-US')}d</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatSignedDays(row.difference)}</td>
                    <td className="px-4 py-3 pr-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={within ? 'default' : 'warning'}>{within ? 'Yes' : 'No'}</Badge>
                        {row.approximate ? <span className="text-xs text-primary">approx</span> : null}
                        {row.endsAtAnchor ? <span className="text-xs text-muted">in-sample anchor</span> : null}
                        {row.honest ? <span className="text-xs text-muted">honest set</span> : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="px-6 py-3 text-[0.8125rem] text-muted">
          * The 2013 top is an approximate weekly anchor retained from the original file. The 2022–2025 bull ends on 6
          Oct 2025 — the same peak the model is projecting from — so it is not treated as out-of-sample validation.
        </p>
        <div className="grid gap-4 border-t border-border bg-[#0f141c] px-6 py-4 sm:grid-cols-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span>Projected bear · {study.config.bearDays} days</span>
            <span className="font-mono text-xs text-muted">
              {formatDate(study.intervals.at(-1)?.to.date ?? '')} → {formatDate(study.targets.bottom.date)}
            </span>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span>Projected bull · {study.config.bullDays.toLocaleString('en-US')} days</span>
            <span className="font-mono text-xs text-muted">
              {formatDate(study.targets.bottom.date)} → {formatDate(study.targets.top.date)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
