import { describe, expect, it } from 'vitest'
import { computeYDomain } from '@/lib/chart-model'

describe('y-domain', () => {
  it('keeps linear min above 0 and ignores a $2M envelope print', () => {
    const [min, max] = computeYDomain({
      primary: [66000, 126000],
      extras: [2_120_000, 25000],
      scale: 'linear',
    })
    expect(min).toBeGreaterThan(0)
    expect(min).toBeLessThan(66000)
    expect(max).toBeLessThan(400000)
    expect(max).toBeGreaterThan(126000)
  })
})
