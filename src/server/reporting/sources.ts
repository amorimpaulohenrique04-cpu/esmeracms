import { sql } from '@payloadcms/db-postgres/drizzle'
import type { Payload } from 'payload'

import { numberFromRow, nullableNumberFromRow, runReportingQuery, stringFromRow } from './db'
import {
  closedOpportunityWhere,
  createdOpportunityWhere,
  leadAcquisitionWhere,
  salesWhere,
} from './filters'
import { safeRatio, type NormalizedReportingFilters } from './metrics'

export type LeadSourceRow = {
  source: string
  leads: number
  share: number | null
}

export type LeadAcquisitionSnapshot = {
  total: number
  sources: LeadSourceRow[]
}

export type SourcePerformanceRow = {
  source: string
  opportunitiesCreated: number
  wonOpportunities: number
  lostOpportunities: number
  conversionRate: number | null
  validSales: number
  revenueCents: number
}

export async function getLeadAcquisitionBySource(
  payload: Payload,
  filters: NormalizedReportingFilters,
): Promise<LeadAcquisitionSnapshot> {
  const where = leadAcquisitionWhere(filters)
  const rows = await runReportingQuery(payload, 'sources.lead-acquisition', sql`
    SELECT
      COALESCE(l.source::text, 'other') AS source,
      COUNT(*)::integer AS lead_count,
      COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (), 0) AS source_share
    FROM leads l
    WHERE ${where}
    GROUP BY COALESCE(l.source::text, 'other')
    ORDER BY lead_count DESC, source ASC
  `)
  const sources = rows.map((row) => ({
    source: stringFromRow(row.source, 'other'),
    leads: numberFromRow(row.lead_count),
    share: nullableNumberFromRow(row.source_share),
  }))

  return {
    total: sources.reduce((total, row) => total + row.leads, 0),
    sources,
  }
}

export async function getSourcePerformance(
  payload: Payload,
  filters: NormalizedReportingFilters,
): Promise<SourcePerformanceRow[]> {
  const createdWhere = createdOpportunityWhere(filters)
  const closedWhere = closedOpportunityWhere(filters)
  const validSaleWhere = salesWhere(filters)
  const rows = await runReportingQuery(payload, 'sources.performance', sql`
    WITH created_source AS (
      SELECT
        COALESCE(o.source::text, 'other') AS source,
        COUNT(*)::integer AS opportunities_created
      FROM opportunities o
      WHERE ${createdWhere}
      GROUP BY COALESCE(o.source::text, 'other')
    ),
    closed_source AS (
      SELECT
        COALESCE(o.source::text, 'other') AS source,
        (COUNT(*) FILTER (WHERE o.stage = 'won'))::integer AS won_opportunities,
        (COUNT(*) FILTER (WHERE o.stage = 'lost'))::integer AS lost_opportunities
      FROM opportunities o
      WHERE ${closedWhere}
      GROUP BY COALESCE(o.source::text, 'other')
    ),
    sale_source AS (
      SELECT
        COALESCE(sale_opportunity.source::text, 'unattributed') AS source,
        COUNT(*)::integer AS valid_sales,
        COALESCE(SUM(s.total_cents), 0)::bigint AS revenue_cents
      FROM sales s
      LEFT JOIN opportunities sale_opportunity
        ON sale_opportunity.id = s.opportunity_id
      WHERE ${validSaleWhere}
      GROUP BY COALESCE(sale_opportunity.source::text, 'unattributed')
    ),
    source_keys AS (
      SELECT source FROM created_source
      UNION
      SELECT source FROM closed_source
      UNION
      SELECT source FROM sale_source
    )
    SELECT
      source_keys.source,
      COALESCE(created_source.opportunities_created, 0)::integer AS opportunities_created,
      COALESCE(closed_source.won_opportunities, 0)::integer AS won_opportunities,
      COALESCE(closed_source.lost_opportunities, 0)::integer AS lost_opportunities,
      COALESCE(sale_source.valid_sales, 0)::integer AS valid_sales,
      COALESCE(sale_source.revenue_cents, 0)::bigint AS revenue_cents
    FROM source_keys
    LEFT JOIN created_source USING (source)
    LEFT JOIN closed_source USING (source)
    LEFT JOIN sale_source USING (source)
    ORDER BY opportunities_created DESC, revenue_cents DESC, source_keys.source ASC
  `)

  return rows.map((row) => {
    const won = numberFromRow(row.won_opportunities)
    const lost = numberFromRow(row.lost_opportunities)
    return {
      source: stringFromRow(row.source, 'other'),
      opportunitiesCreated: numberFromRow(row.opportunities_created),
      wonOpportunities: won,
      lostOpportunities: lost,
      conversionRate: safeRatio(won, won + lost),
      validSales: numberFromRow(row.valid_sales),
      revenueCents: numberFromRow(row.revenue_cents),
    }
  })
}
