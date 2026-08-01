import { sql } from '@payloadcms/db-postgres/drizzle'
import type { Payload } from 'payload'

import { numberFromRow, runReportingQuery, stringFromRow } from './db'
import {
  comparisonPeriod,
  createdOpportunityWhere,
  filtersForPeriod,
  leadAcquisitionWhere,
  salesWhere,
} from './filters'
import { REPORTING_TIME_ZONE, type NormalizedReportingFilters } from './metrics'

export type CommercialEvolutionPoint = {
  date: string
  leads: number
  opportunities: number
  sales: number
  revenueCents: number
}

export type CommercialEvolution = {
  current: CommercialEvolutionPoint[]
  previous: CommercialEvolutionPoint[] | null
}

async function getPeriodEvolution(
  payload: Payload,
  filters: NormalizedReportingFilters,
  queryName: string,
): Promise<CommercialEvolutionPoint[]> {
  const leadWhere = leadAcquisitionWhere(filters)
  const opportunityWhere = createdOpportunityWhere(filters)
  const validSaleWhere = salesWhere(filters)
  const rows = await runReportingQuery(payload, queryName, sql`
    WITH days AS (
      SELECT generate_series(
        (${filters.period.from}::timestamptz AT TIME ZONE ${REPORTING_TIME_ZONE})::date,
        (${filters.period.to}::timestamptz AT TIME ZONE ${REPORTING_TIME_ZONE})::date,
        INTERVAL '1 day'
      )::date AS bucket
    ),
    lead_daily AS (
      SELECT
        DATE_TRUNC('day', l.created_at AT TIME ZONE ${REPORTING_TIME_ZONE})::date AS bucket,
        COUNT(*)::integer AS lead_count
      FROM leads l
      WHERE ${leadWhere}
      GROUP BY 1
    ),
    opportunity_daily AS (
      SELECT
        DATE_TRUNC('day', o.created_at AT TIME ZONE ${REPORTING_TIME_ZONE})::date AS bucket,
        COUNT(*)::integer AS opportunity_count
      FROM opportunities o
      WHERE ${opportunityWhere}
      GROUP BY 1
    ),
    sales_daily AS (
      SELECT
        DATE_TRUNC('day', s.confirmed_at AT TIME ZONE ${REPORTING_TIME_ZONE})::date AS bucket,
        COUNT(*)::integer AS sales_count,
        COALESCE(SUM(s.total_cents), 0)::bigint AS revenue_cents
      FROM sales s
      WHERE ${validSaleWhere}
      GROUP BY 1
    )
    SELECT
      TO_CHAR(days.bucket, 'YYYY-MM-DD') AS bucket,
      COALESCE(lead_daily.lead_count, 0)::integer AS lead_count,
      COALESCE(opportunity_daily.opportunity_count, 0)::integer AS opportunity_count,
      COALESCE(sales_daily.sales_count, 0)::integer AS sales_count,
      COALESCE(sales_daily.revenue_cents, 0)::bigint AS revenue_cents
    FROM days
    LEFT JOIN lead_daily USING (bucket)
    LEFT JOIN opportunity_daily USING (bucket)
    LEFT JOIN sales_daily USING (bucket)
    ORDER BY days.bucket ASC
  `)

  return rows.map((row) => ({
    date: stringFromRow(row.bucket),
    leads: numberFromRow(row.lead_count),
    opportunities: numberFromRow(row.opportunity_count),
    sales: numberFromRow(row.sales_count),
    revenueCents: numberFromRow(row.revenue_cents),
  }))
}

export async function getCommercialEvolution(
  payload: Payload,
  filters: NormalizedReportingFilters,
): Promise<CommercialEvolution> {
  const previous = comparisonPeriod(filters)
  const [current, previousSeries] = await Promise.all([
    getPeriodEvolution(payload, filters, 'timeline.current'),
    previous
      ? getPeriodEvolution(payload, filtersForPeriod(filters, previous), 'timeline.previous')
      : Promise.resolve(null),
  ])

  return { current, previous: previousSeries }
}
