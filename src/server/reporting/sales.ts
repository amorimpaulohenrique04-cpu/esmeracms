import { sql } from '@payloadcms/db-postgres/drizzle'
import type { Payload } from 'payload'

import { numberFromRow, nullableNumberFromRow, runReportingQuery, stringFromRow } from './db'
import { salesWhere } from './filters'
import { REPORTING_TIME_ZONE, type NormalizedReportingFilters } from './metrics'

export type SalesMetrics = {
  validSales: number
  revenueCents: number
  averageTicketCents: number | null
}

export type SalesTimelinePoint = {
  date: string
  sales: number
  revenueCents: number
}

export type SalesChannelRow = {
  channel: string
  sales: number
  revenueCents: number
  salesShare: number | null
}

export async function getSalesMetrics(
  payload: Payload,
  filters: NormalizedReportingFilters,
): Promise<SalesMetrics> {
  const where = salesWhere(filters)
  const rows = await runReportingQuery(payload, 'sales.summary', sql`
    SELECT
      COUNT(*)::integer AS sales_count,
      COALESCE(SUM(s.total_cents), 0)::bigint AS revenue_cents,
      ROUND(AVG(s.total_cents))::bigint AS average_ticket_cents
    FROM sales s
    WHERE ${where}
  `)
  const row = rows[0] || {}

  return {
    validSales: numberFromRow(row.sales_count),
    revenueCents: numberFromRow(row.revenue_cents),
    averageTicketCents: nullableNumberFromRow(row.average_ticket_cents),
  }
}

export async function getSalesTimeline(
  payload: Payload,
  filters: NormalizedReportingFilters,
): Promise<SalesTimelinePoint[]> {
  const where = salesWhere(filters)
  const rows = await runReportingQuery(payload, 'sales.timeline', sql`
    SELECT
      TO_CHAR(DATE_TRUNC('day', s.confirmed_at AT TIME ZONE ${REPORTING_TIME_ZONE}), 'YYYY-MM-DD') AS bucket,
      COUNT(*)::integer AS sales_count,
      COALESCE(SUM(s.total_cents), 0)::bigint AS revenue_cents
    FROM sales s
    WHERE ${where}
    GROUP BY bucket
    ORDER BY bucket ASC
  `)

  return rows.map((row) => ({
    date: stringFromRow(row.bucket),
    sales: numberFromRow(row.sales_count),
    revenueCents: numberFromRow(row.revenue_cents),
  }))
}

export async function getSalesByChannel(
  payload: Payload,
  filters: NormalizedReportingFilters,
): Promise<SalesChannelRow[]> {
  const where = salesWhere(filters)
  const rows = await runReportingQuery(payload, 'sales.channels', sql`
    SELECT
      COALESCE(s.channel::text, 'other') AS channel,
      COUNT(*)::integer AS sales_count,
      COALESCE(SUM(s.total_cents), 0)::bigint AS revenue_cents,
      COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (), 0) AS sales_share
    FROM sales s
    WHERE ${where}
    GROUP BY COALESCE(s.channel::text, 'other')
    ORDER BY sales_count DESC, revenue_cents DESC
  `)

  return rows.map((row) => ({
    channel: stringFromRow(row.channel, 'other'),
    sales: numberFromRow(row.sales_count),
    revenueCents: numberFromRow(row.revenue_cents),
    salesShare: nullableNumberFromRow(row.sales_share),
  }))
}
