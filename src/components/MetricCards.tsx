import { formatCompact, formatDate, formatMoney } from '@/lib/format'
import { ANCHOR, relativeDate, type Study } from '@/lib/study'
import type { DisplayedPrice, PhaseInfo } from '@/lib/types'
import { cn } from '@/lib/utils'

type Props = {
  price: DisplayedPrice
  study: Study
  phase: PhaseInfo
  now: number
  lastWeeklyLabel: string
}

function Metric({
  label,
  value,
  details,
  className,
  valueClassName,
  progress,
  progressClassName,
}: {
  label: string
  value: string
  details: string[]
  className?: string
  valueClassName?: string
  progress?: number
  progressClassName?: string
}) {
  return (
    <article className={cn('flex min-w-0 flex-col rounded-[10px] border border-border bg-card px-5 py-4', className)}>
      <h3 className="mb-2.5 text-sm text-muted">{label}</h3>
      <p className={cn('mb-1.5 text-[clamp(1.15rem,1.7vw,1.75rem)] font-semibold tracking-tight tabular-nums', valueClassName)}>
        {value}
      </p>
      {details.map((line) => (
        <p key={line} className="text-[0.8125rem] text-muted">
          {line}
        </p>
      ))}
      {progress !== undefined ? (
        <div
          className="mt-3 h-[3px] w-full overflow-hidden rounded-sm bg-[#2a3340]"
          role="progressbar"
          aria-label="Modeled phase progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <span className={cn('block h-full rounded-sm', progressClassName)} style={{ width: `${progress}%` }} />
        </div>
      ) : null}
    </article>
  )
}

export function MetricCards({ price, study, phase, now, lastWeeklyLabel }: Props) {
  const relationPct = (price.value / ANCHOR.price - 1) * 100
  const relation =
    Math.abs(relationPct) < 0.05
      ? 'At the study peak'
      : `${Math.abs(relationPct).toFixed(1)}% ${relationPct > 0 ? 'above' : 'below'} study peak`
  const phaseClass = phase.name === 'Modeled bear' ? 'text-bear' : phase.name === 'Modeled bull' ? 'text-bull' : ''
  const progressClass = phase.name === 'Modeled bull' ? 'bg-bull' : 'bg-bear'

  return (
    <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Study summary">
      <Metric
        className="border-[#73502d] bg-[#181a1e] sm:col-span-2 xl:col-span-1"
        label={price.snapshot ? 'Weekly snapshot' : 'Latest quote'}
        value={formatMoney(price.value)}
        valueClassName="text-primary"
        details={[
          relation,
          price.label,
          price.kind === 'live' ? lastWeeklyLabel : 'Embedded Tuesday series · not a live print',
        ]}
      />
      <Metric
        label="Study peak"
        value={formatMoney(ANCHOR.price)}
        details={[formatDate(ANCHOR.date), 'Fixed cycle anchor']}
      />
      <Metric
        label="Timing model"
        value={phase.name}
        valueClassName={phaseClass}
        details={[phase.copy]}
        progress={phase.duration ? phase.progress : undefined}
        progressClassName={progressClass}
      />
      <Metric
        className="xl:col-span-1"
        label="Bottom range"
        value={formatDate(study.targets.bottom.date)}
        valueClassName="text-[clamp(1.05rem,1.5vw,1.45rem)]"
        details={[
          `${formatCompact(study.targets.bottom.low)}–${formatCompact(study.targets.bottom.high)}`,
          `${relativeDate(study.targets.bottom.date, now)} · working model date`,
        ]}
      />
      <Metric
        label="Top range"
        value={formatDate(study.targets.top.date)}
        valueClassName="text-[clamp(1.05rem,1.5vw,1.45rem)]"
        details={[
          `${formatCompact(study.targets.top.low)}–${formatCompact(study.targets.top.high)}`,
          `${relativeDate(study.targets.top.date, now)} · working model date`,
        ]}
      />
    </section>
  )
}
