import type { SQL } from '@payloadcms/db-postgres/drizzle'
import type { Payload } from 'payload'

type QueryRow = Record<string, unknown>

type QueryResultWithRows = {
  rows?: unknown
}

type QueryTiming = {
  name: string
  durationMs: number
  p95Ms: number
  sampleSize: number
}

const MAX_TIMING_SAMPLES = 200
const timings = new Map<string, number[]>()

function isRecord(value: unknown): value is QueryRow {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function rowsFromResult(result: unknown): QueryRow[] {
  if (Array.isArray(result)) return result.filter(isRecord)
  if (!isRecord(result)) return []

  const rows = (result as QueryResultWithRows).rows
  return Array.isArray(rows) ? rows.filter(isRecord) : []
}

function percentile95(samples: number[]) {
  if (!samples.length) return 0
  const sorted = [...samples].sort((left, right) => left - right)
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1)
  return sorted[index]
}

function recordTiming(name: string, durationMs: number): QueryTiming {
  const current = timings.get(name) || []
  const next = [...current, durationMs].slice(-MAX_TIMING_SAMPLES)
  timings.set(name, next)

  return {
    name,
    durationMs: Math.round(durationMs * 100) / 100,
    p95Ms: Math.round(percentile95(next) * 100) / 100,
    sampleSize: next.length,
  }
}

export async function runReportingQuery(
  payload: Payload,
  name: string,
  query: SQL,
): Promise<QueryRow[]> {
  const startedAt = performance.now()

  try {
    const result = await payload.db.drizzle.execute(query)
    return rowsFromResult(result)
  } finally {
    const timing = recordTiming(name, performance.now() - startedAt)
    const shouldLog = process.env.REPORTING_QUERY_LOGS === 'true' || timing.durationMs >= 800
    if (process.env.NODE_ENV !== 'test' && shouldLog) console.info('[reporting.query]', timing)
  }
}

export function reportingPerformanceSnapshot() {
  return Array.from(timings.entries())
    .map(([name, samples]) => ({
      name,
      p95Ms: Math.round(percentile95(samples) * 100) / 100,
      sampleSize: samples.length,
    }))
    .sort((left, right) => right.p95Ms - left.p95Ms)
}

export function numberFromRow(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

export function nullableNumberFromRow(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const parsed = numberFromRow(value, Number.NaN)
  return Number.isFinite(parsed) ? parsed : null
}

export function stringFromRow(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  if (value === null || value === undefined) return fallback
  return String(value)
}
