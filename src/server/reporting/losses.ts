import { sql } from '@payloadcms/db-postgres/drizzle'
import type { Payload } from 'payload'

import {
  opportunityLossReasonLabels,
  type OpportunityLossReason,
} from '../../businessRules/opportunities/stages'
import { numberFromRow, nullableNumberFromRow, runReportingQuery, stringFromRow } from './db'
import { closedOpportunityWhere } from './filters'
import type { NormalizedReportingFilters } from './metrics'

export type LossReasonRow = {
  reason: string
  label: string
  volume: number
  shareOfLosses: number | null
}

export async function getLossReasons(
  payload: Payload,
  filters: NormalizedReportingFilters,
): Promise<LossReasonRow[]> {
  const where = closedOpportunityWhere(filters)
  const rows = await runReportingQuery(payload, 'losses.ranking', sql`
    SELECT
      COALESCE(o.loss_reason::text, 'other') AS reason,
      COUNT(*)::integer AS loss_count,
      COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (), 0) AS loss_share
    FROM opportunities o
    WHERE ${where}
      AND o.stage = 'lost'
    GROUP BY COALESCE(o.loss_reason::text, 'other')
    ORDER BY loss_count DESC, reason ASC
    LIMIT 50
  `)

  return rows.map((row) => {
    const reason = stringFromRow(row.reason, 'other')
    return {
      reason,
      label: opportunityLossReasonLabels[reason as OpportunityLossReason] || reason,
      volume: numberFromRow(row.loss_count),
      shareOfLosses: nullableNumberFromRow(row.loss_share),
    }
  })
}
