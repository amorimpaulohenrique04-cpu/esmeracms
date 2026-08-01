import { beforeEach, describe, expect, it } from 'vitest'

import {
  PERFORMANCE_BUDGETS,
  performanceSnapshot,
  percentile95,
  recordPerformanceMeasurement,
  resetPerformanceMeasurements,
} from '../../src/server/performance'

describe('performance instrumentation', () => {
  beforeEach(() => resetPerformanceMeasurements())

  it('calculates deterministic P95 and evaluates the operational budget', () => {
    expect(percentile95([10, 20, 30, 40, 500])).toBe(500)

    for (const duration of [80, 90, 100, 110, 120]) {
      recordPerformanceMeasurement('operational', 'products.find', duration)
    }

    const [measurement] = performanceSnapshot('operational')
    expect(measurement).toMatchObject({
      area: 'operational',
      name: 'products.find',
      p95Ms: 120,
      sampleSize: 5,
      budgetMs: PERFORMANCE_BUDGETS.operationalQueryP95Ms,
      withinBudget: true,
    })
  })

  it('flags reporting queries above the declared P95 budget without storing input data', () => {
    recordPerformanceMeasurement('reporting', 'report.snapshot', 900)
    const [measurement] = performanceSnapshot('reporting')
    expect(measurement.withinBudget).toBe(false)
    expect(Object.keys(measurement).sort()).toEqual(['area', 'budgetMs', 'name', 'p95Ms', 'sampleSize', 'withinBudget'].sort())
  })
})
