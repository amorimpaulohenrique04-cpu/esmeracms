import { sql } from '@payloadcms/db-postgres/drizzle'
import type { Payload } from 'payload'

import { numberFromRow, nullableNumberFromRow, runReportingQuery, stringFromRow } from './db'
import { closedOpportunityWhere, createdOpportunityWhere, salesWhere } from './filters'
import { safeRatio, type NormalizedReportingFilters } from './metrics'

export type TeamPerformanceRow = {
  ownerId: number | null
  ownerName: string
  opportunitiesCreated: number
  wonOpportunities: number
  lostOpportunities: number
  conversionRate: number | null
  validSales: number
  revenueCents: number
  averageTicketCents: number | null
}

export async function getTeamPerformance(
  payload: Payload,
  filters: NormalizedReportingFilters,
): Promise<TeamPerformanceRow[]> {
  const createdWhere = createdOpportunityWhere(filters)
  const closedWhere = closedOpportunityWhere(filters)
  const validSaleWhere = salesWhere(filters)
  const rows = await runReportingQuery(payload, 'team.performance', sql`
    WITH created_owner AS (
      SELECT o.owner_id, COUNT(*)::integer AS opportunities_created
      FROM opportunities o
      WHERE ${createdWhere}
      GROUP BY o.owner_id
    ),
    closed_owner AS (
      SELECT
        o.owner_id,
        (COUNT(*) FILTER (WHERE o.stage = 'won'))::integer AS won_opportunities,
        (COUNT(*) FILTER (WHERE o.stage = 'lost'))::integer AS lost_opportunities
      FROM opportunities o
      WHERE ${closedWhere}
      GROUP BY o.owner_id
    ),
    sale_owner AS (
      SELECT
        s.owner_id,
        COUNT(*)::integer AS valid_sales,
        COALESCE(SUM(s.total_cents), 0)::bigint AS revenue_cents,
        ROUND(AVG(s.total_cents))::bigint AS average_ticket_cents
      FROM sales s
      WHERE ${validSaleWhere}
      GROUP BY s.owner_id
    ),
    owner_keys AS (
      SELECT owner_id FROM created_owner
      UNION
      SELECT owner_id FROM closed_owner
      UNION
      SELECT owner_id FROM sale_owner
    )
    SELECT
      owner_keys.owner_id,
      CASE
        WHEN owner_keys.owner_id IS NULL THEN 'Não atribuído'
        ELSE COALESCE(NULLIF(TRIM(owner_user.name), ''), 'Usuário #' || owner_keys.owner_id::text)
      END AS owner_name,
      COALESCE(created_owner.opportunities_created, 0)::integer AS opportunities_created,
      COALESCE(closed_owner.won_opportunities, 0)::integer AS won_opportunities,
      COALESCE(closed_owner.lost_opportunities, 0)::integer AS lost_opportunities,
      COALESCE(sale_owner.valid_sales, 0)::integer AS valid_sales,
      COALESCE(sale_owner.revenue_cents, 0)::bigint AS revenue_cents,
      sale_owner.average_ticket_cents
    FROM owner_keys
    LEFT JOIN users owner_user ON owner_user.id = owner_keys.owner_id
    LEFT JOIN created_owner ON created_owner.owner_id IS NOT DISTINCT FROM owner_keys.owner_id
    LEFT JOIN closed_owner ON closed_owner.owner_id IS NOT DISTINCT FROM owner_keys.owner_id
    LEFT JOIN sale_owner ON sale_owner.owner_id IS NOT DISTINCT FROM owner_keys.owner_id
    ORDER BY revenue_cents DESC, opportunities_created DESC, owner_name ASC
  `)

  return rows.map((row) => {
    const won = numberFromRow(row.won_opportunities)
    const lost = numberFromRow(row.lost_opportunities)
    return {
      ownerId: row.owner_id === null || row.owner_id === undefined ? null : numberFromRow(row.owner_id),
      ownerName: stringFromRow(row.owner_name, 'Não atribuído'),
      opportunitiesCreated: numberFromRow(row.opportunities_created),
      wonOpportunities: won,
      lostOpportunities: lost,
      conversionRate: safeRatio(won, won + lost),
      validSales: numberFromRow(row.valid_sales),
      revenueCents: numberFromRow(row.revenue_cents),
      averageTicketCents: nullableNumberFromRow(row.average_ticket_cents),
    }
  })
}
