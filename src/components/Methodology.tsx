import { formatDate, formatMoney } from '@/lib/format'
import { analogPriceErrors, ANCHOR, type Study } from '@/lib/study'

type Props = { study: Study }

export function Methodology({ study }: Props) {
  const end = study.envelope.at(-1)
  const errors = analogPriceErrors(study.analogs)
  const ext = study.data.source.extension
  return (
    <details className="mb-6 overflow-hidden rounded-xl border border-border bg-card">
      <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-4 text-sm hover:bg-[#171e28]">
        <span>Data &amp; model notes</span>
        <span className="text-[0.8125rem] text-muted">
          Method, error, sources <span aria-hidden="true">＋</span>
        </span>
      </summary>
      <div className="grid gap-8 border-t border-border p-6 lg:grid-cols-3">
        <div className="space-y-3 text-[1rem] leading-relaxed text-muted">
          <h3 className="text-foreground">Price history &amp; quotes</h3>
          <p>
            {study.data.prices.length} Tuesday weekly closes from {formatDate(study.firstWeekly.d)} to{' '}
            {formatDate(study.latestWeekly.d)}. Through 30 Sep 2025 the series is the original study file. From the week
            of the 6 Oct 2025 study peak ({ext?.from ?? '7 Oct 2025'}) through {ext?.to ?? study.latestWeekly.d} every
            Tuesday is a CoinGecko daily USD print on that date — documented public API actuals, not analog or envelope
            values. The Sunday 29 Mar 2026 snapshot is omitted because it is not a weekly close.
          </p>
          <p>
            On load the page fetches a CoinGecko live quote and refreshes post-peak Tuesdays. The Vite app uses{' '}
            <code className="text-foreground">/api/coingecko</code> (proxy to {ext?.endpoint ?? 'api.coingecko.com'}).
            The downloadable HTML talks to CoinGecko directly; if the browser blocks that, the error is shown and the
            embedded weekly series still works. The live print is appended on the actual path; it is not a Tuesday
            close.
          </p>
        </div>
        <div className="space-y-3 text-[1rem] leading-relaxed text-muted">
          <h3 className="text-foreground">Timing &amp; price projections</h3>
          <p>
            Default model is analog-calibrated, not the original hardcoded {formatMoney(18614)}–{formatMoney(28622)} /{' '}
            {formatMoney(150589)}–{formatMoney(617084)} pair. Bear length is the median of the 2017–18 and 2021–22 event
            clocks ({study.analogDefaults.bearDays}d). Bull length is the median of the three completed bulls (
            {study.analogDefaults.bullDays}d). Inner date band is ±{study.config.toleranceDays} calendar days; the outer
            dashed band is the 2013 +43-day late-bottom outlier.
          </p>
          <p>
            Bottom dollars are weekly-close remaining value at each analog trough, scaled to the {formatDate(ANCHOR.date)}{' '}
            peak of {formatMoney(ANCHOR.price)}. That is {formatMoney(study.analogDefaults.bottom.low)}–
            {formatMoney(study.analogDefaults.bottom.high)}. Top dollars apply only the 2018 and 2022 bull multiples to
            the median analog bottom (the 2013-era blow-off multiple is an outer historical comment, not an inner
            forecast). Classic 364/1,064 remains a toggle for comparison.
          </p>
          <p>
            All dates are UTC calendar days. “Modeled bear/bull” is a clock assumption, not a verified regime. The study
            peak is a fixed reference, not a live all-time high.
          </p>
        </div>
        <div className="space-y-3 text-[1rem] leading-relaxed text-muted">
          <h3 className="text-foreground">Error, analogs, envelope</h3>
          <p>
            Out-of-sample-ish price check: analog remaining-value at the next bottom vs the median of prior analog
            bottoms.{' '}
            {errors
              .map(
                (row) =>
                  `${row.predictedCycle}: predicted ${(row.predictedRemaining * 100).toFixed(1)}% of peak, actual ${(row.actualRemaining * 100).toFixed(1)}% (${row.errorPp > 0 ? '+' : ''}${row.errorPp.toFixed(1)} pp, later bottoms were shallower)`,
              )
              .join(' ')}
            . Timing leave-one-out MAE is {study.looMae.toFixed(1)} days on honest intervals.
          </p>
          <p>
            Analog, envelope, from-today fan, and working-model paths are clipped to the last actual print (live quote
            if fresh, otherwise the last Tuesday close) and rebased so they start at that price. Remaining analog shape
            is ratio-scaled from the analog’s implied level on that day-count. Envelope min/mean/max are ratio-scaled
            from their values at today’s cycle fraction. They are off by default and toggled per series in the chart
            legend. They are not drawn across 2025 → today as if that history were unknown.
          </p>
          <p>
            Un-rebased, the imported envelope at the far horizon spans {end ? `${formatMoney(end.min)}–${formatMoney(end.max)}` : 'n/a'}{' '}
            (mean {end ? formatMoney(end.avg) : 'n/a'}). That absolute scale is a historical reference used in the
            falsification panel; the chart envelope is the today-rebased copy.
          </p>
        </div>
      </div>
    </details>
  )
}
