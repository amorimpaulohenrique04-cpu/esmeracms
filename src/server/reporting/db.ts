import type { SQL } from '@payloadcms/db-postgres/drizzle'
import type { Payload } from 'payload'

import {
  PERFORMANCE_BUDGETS,
  performanceSnapshot,
  recordPerformanceMeasurement,
} from '../performance'

type QueryRow = Record<string, unknown>

type QueryResultWithRows = {
  rows?: unknown
}

function isRecord(value: unknown): value is QueryRow {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function rowsFromResult(result: unknown): QueryRow[] {
  if (Array.isArray(result)) return result.filter(isRecord)
  if (!isRecord(result)) return []

  const rows = (result as QueryResultWithRows).rows
  return Array.isArray(rows) ? rows.filter(isRecord) : []
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
    const timing = recordPerformanceMeasurement('reporting', name, performance.now() - startedAt)
    const shouldLog = process.env.REPORTING_QUERY_LOGS === 'true' ||
      process.env.PERFORMANCE_LOGS === 'true' ||
      timing.p95Ms > PERFORMANCE_BUDGETS.reportingQueryP95Ms
    if (process.env.NODE_ENV !== 'test' && shouldLog) console.info('[reporting.query]', timing)
  }
}

export function reportingPerformanceSnapshot() {
  return performanceSnapshot('reporting').map(({ name, p95Ms, sampleSize }) => ({
    name,
    p95Ms,
    sampleSize,
  }))
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
