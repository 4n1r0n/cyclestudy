import { formatCompact, formatDate, formatMoney, formatSignedDays } from '@/lib/format'
import type { ProjectionMode, WorkingConfig } from '@/lib/types'
import { CLASSIC_CONFIG, type Study } from '@/lib/study'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'

type Props = {
  study: Study
  mode: ProjectionMode
  config: WorkingConfig
  onMode: (mode: ProjectionMode) => void
  onChange: (config: WorkingConfig) => void
}

function MoneyField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={1}
        step={100}
        value={Math.round(value)}
        onChange={(event) => {
          const next = Number(event.target.value)
          if (Number.isFinite(next) && next > 0) onChange(next)
        }}
      />
    </div>
  )
}

export function SensitivityPanel({ study, mode, config, onMode, onChange }: Props) {
  const analog = study.analogDefaults
  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-[0.75rem] tracking-[0.08em] text-muted">SENSITIVITY</p>
          <CardTitle>Working clock and ranges</CardTitle>
          <CardDescription>
            MAE below uses this bear/bull length on the honest historical set. Analog-calibrated defaults are rebuilt
            from weekly-close analogs; classic restores the original 364/1,064 constants.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={mode === 'analog' ? 'default' : 'outline'} onClick={() => onMode('analog')}>
            Analog-calibrated
          </Button>
          <Button variant={mode === 'classic' ? 'default' : 'outline'} onClick={() => onMode('classic')}>
            Classic 364/1,064
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="bear-days">Bear length</Label>
              <span className="font-mono text-sm">{config.bearDays} days</span>
            </div>
            <Slider
              id="bear-days"
              min={300}
              max={450}
              step={1}
              value={[config.bearDays]}
              onValueChange={([bearDays]) => onChange({ ...config, bearDays })}
            />
            <p className="text-xs text-muted">
              Analog median {analog.bearDays}d · classic {CLASSIC_CONFIG.bearDays}d · bottom clock{' '}
              {formatDate(study.targets.bottom.date)}
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="bull-days">Bull length</Label>
              <span className="font-mono text-sm">{config.bullDays.toLocaleString('en-US')} days</span>
            </div>
            <Slider
              id="bull-days"
              min={900}
              max={1200}
              step={1}
              value={[config.bullDays]}
              onValueChange={([bullDays]) => onChange({ ...config, bullDays })}
            />
            <p className="text-xs text-muted">
              Analog median {analog.bullDays}d · classic {CLASSIC_CONFIG.bullDays.toLocaleString('en-US')}d · top clock{' '}
              {formatDate(study.targets.top.date)}
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MoneyField
            id="bottom-low"
            label="Bottom low"
            value={config.bottom.low}
            onChange={(low) => onChange({ ...config, bottom: { ...config.bottom, low: Math.min(low, config.bottom.high) } })}
          />
          <MoneyField
            id="bottom-high"
            label="Bottom high"
            value={config.bottom.high}
            onChange={(high) => onChange({ ...config, bottom: { ...config.bottom, high: Math.max(high, config.bottom.low) } })}
          />
          <MoneyField
            id="top-low"
            label="Top low"
            value={config.top.low}
            onChange={(low) => onChange({ ...config, top: { ...config.top, low: Math.min(low, config.top.high) } })}
          />
          <MoneyField
            id="top-high"
            label="Top high"
            value={config.top.high}
            onChange={(high) => onChange({ ...config, top: { ...config.top, high: Math.max(high, config.top.low) } })}
          />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-border bg-[#0f141c] p-4">
          <div>
            <p className="text-xs tracking-wide text-muted uppercase">Honest MAE (live)</p>
            <p className="font-semibold text-primary text-[1.7rem] leading-none">{study.honestMae.toFixed(1)} days</p>
            <p className="mt-2 text-[0.8125rem] text-muted">
              {study.withinTolerance.count} of {study.withinTolerance.total} honest intervals within ±{config.toleranceDays}d.
              All-interval MAE {study.allMae.toFixed(1)}d includes 2013* and the 2022–2025 bull that ends on the projection
              anchor. Leave-one-out {study.looMae.toFixed(1)}d.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => onChange(mode === 'analog' ? analog : CLASSIC_CONFIG)}
          >
            Reset {mode === 'analog' ? 'analog' : 'classic'} defaults
          </Button>
        </div>
        <p className="text-[0.8125rem] text-muted">
          Analog price defaults: weekly-close remaining-value range {formatMoney(analog.bottom.low)}–
          {formatMoney(analog.bottom.high)} at the study peak; top {formatCompact(analog.top.low)}–
          {formatCompact(analog.top.high)} from the 2018/2022 bull multiples applied to the median analog bottom. The
          2013-era 90×+ multiple is excluded from the inner top band.
        </p>
        <p className="font-mono text-xs text-muted">
          {study.intervals
            .map((row) => `${row.phase} ${formatSignedDays(row.difference)}`)
            .join(' · ')}
        </p>
      </CardContent>
    </Card>
  )
}
