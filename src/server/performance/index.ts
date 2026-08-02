export type PerformanceArea = 'operational' | 'reporting' | 'navigation'

export type PerformanceMeasurement = {
  area: PerformanceArea
  name: string
  durationMs: number
  p95Ms: number
  sampleSize: number
  budgetMs: number
  withinBudget: boolean
}

export const PERFORMANCE_BUDGETS = {
  localFeedbackMs: 100,
  hotNavigationMs: 300,
  operationalQueryP95Ms: 250,
  reportingQueryP95Ms: 800,
} as const

const MAX_SAMPLES = 200
const samplesByKey = new Map<string, number[]>()

function keyOf(area: PerformanceArea, name: string) {
  return `${area}:${name}`
}

function budgetFor(area: PerformanceArea) {
  if (area === 'reporting') return PERFORMANCE_BUDGETS.reportingQueryP95Ms
  if (area === 'navigation') return PERFORMANCE_BUDGETS.hotNavigationMs
  return PERFORMANCE_BUDGETS.operationalQueryP95Ms
}

export function percentile95(samples: number[]) {
  if (!samples.length) return 0
  const ordered = [...samples].sort((left, right) => left - right)
  return ordered[Math.max(0, Math.ceil(ordered.length * 0.95) - 1)]
}

export function recordPerformanceMeasurement(
  area: PerformanceArea,
  name: string,
  durationMs: number,
): PerformanceMeasurement {
  const safeDuration = Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : 0
  const key = keyOf(area, name)
  const next = [...(samplesByKey.get(key) || []), safeDuration].slice(-MAX_SAMPLES)
  samplesByKey.set(key, next)
  const p95Ms = percentile95(next)
  const budgetMs = budgetFor(area)

  return {
    area,
    name,
    durationMs: Math.round(safeDuration * 100) / 100,
    p95Ms: Math.round(p95Ms * 100) / 100,
    sampleSize: next.length,
    budgetMs,
    withinBudget: p95Ms <= budgetMs,
  }
}

export async function measureServerOperation<T>(
  area: PerformanceArea,
  name: string,
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = performance.now()
  try {
    return await operation()
  } finally {
    const measurement = recordPerformanceMeasurement(area, name, performance.now() - startedAt)
    const shouldLog = process.env.PERFORMANCE_LOGS === 'true' || !measurement.withinBudget
    if (process.env.NODE_ENV !== 'test' && shouldLog) {
      console.info('[performance.measurement]', measurement)
    }
  }
}

export function performanceSnapshot(area?: PerformanceArea) {
  return Array.from(samplesByKey.entries())
    .map(([key, samples]) => {
      const separator = key.indexOf(':')
      const itemArea = key.slice(0, separator) as PerformanceArea
      const name = key.slice(separator + 1)
      const p95Ms = percentile95(samples)
      const budgetMs = budgetFor(itemArea)
      return {
        area: itemArea,
        name,
        p95Ms: Math.round(p95Ms * 100) / 100,
        sampleSize: samples.length,
        budgetMs,
        withinBudget: p95Ms <= budgetMs,
      }
    })
    .filter((item) => !area || item.area === area)
    .sort((left, right) => right.p95Ms - left.p95Ms)
}

export function resetPerformanceMeasurements() {
  samplesByKey.clear()
}
