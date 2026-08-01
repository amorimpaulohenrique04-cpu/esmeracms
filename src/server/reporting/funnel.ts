import { sql } from '@payloadcms/db-postgres/drizzle'
import type { Payload } from 'payload'

import {
  openOpportunityStages,
  opportunityStages,
  type OpportunityStage,
} from '../../businessRules/opportunities/stages'
import { numberFromRow, nullableNumberFromRow, runReportingQuery, stringFromRow } from './db'
import {
  closedOpportunityWhere,
  createdOpportunityWhere,
  currentOpenOpportunityWhere,
  nativeWonCycleWhere,
} from './filters'
import { safeRatio, type NormalizedReportingFilters } from './metrics'

export type OpportunityMetrics = {
  opportunitiesCreated: number
  wonOpportunities: number
  lostOpportunities: number
  averageSalesCycleDays: number | null
}

export type FunnelStageRow = {
  stage: Exclude<OpportunityStage, 'lost'>
  volume: number
  progressed: number
  dropOff: number
  conversionToNext: number | null
  dropOffRate: number | null
}

export type FunnelSnapshot = {
  stages: FunnelStageRow[]
  lost: number
  terminalConversionRate: number | null
  historySource: 'activities'
}

export type CurrentPipelineStage = {
  stage: (typeof openOpportunityStages)[number]
  volume: number
}

const funnelStages = opportunityStages.filter((stage) => stage !== 'lost') as Exclude<OpportunityStage, 'lost'>[]

function isOpenStage(value: string): value is (typeof openOpportunityStages)[number] {
  return (openOpportunityStages as readonly string[]).includes(value)
}

export async function getOpportunityMetrics(
  payload: Payload,
  filters: NormalizedReportingFilters,
): Promise<OpportunityMetrics> {
  const createdWhere = createdOpportunityWhere(filters)
  const closedWhere = closedOpportunityWhere(filters)
  const cycleWhere = nativeWonCycleWhere(filters)
  const rows = await runReportingQuery(payload, 'funnel.metrics', sql`
    SELECT
      (
        SELECT COUNT(*)::integer
        FROM opportunities o
        WHERE ${createdWhere}
      ) AS opportunities_created,
      (
        SELECT (COUNT(*) FILTER (WHERE o.stage = 'won'))::integer
        FROM opportunities o
        WHERE ${closedWhere}
      ) AS won_opportunities,
      (
        SELECT (COUNT(*) FILTER (WHERE o.stage = 'lost'))::integer
        FROM opportunities o
        WHERE ${closedWhere}
      ) AS lost_opportunities,
      (
        SELECT AVG(EXTRACT(EPOCH FROM (o.closed_at - o.created_at)) / 86400.0)
        FROM opportunities o
        WHERE ${cycleWhere}
      ) AS average_sales_cycle_days
  `)
  const row = rows[0] || {}

  return {
    opportunitiesCreated: numberFromRow(row.opportunities_created),
    wonOpportunities: numberFromRow(row.won_opportunities),
    lostOpportunities: numberFromRow(row.lost_opportunities),
    averageSalesCycleDays: nullableNumberFromRow(row.average_sales_cycle_days),
  }
}

export async function getFunnelSnapshot(
  payload: Payload,
  filters: NormalizedReportingFilters,
): Promise<FunnelSnapshot> {
  const cohortWhere = createdOpportunityWhere(filters)
  const rows = await runReportingQuery(payload, 'funnel.transitions', sql`
    WITH cohort AS (
      SELECT o.id
      FROM opportunities o
      WHERE ${cohortWhere}
    ),
    reached AS (
      SELECT
        a.to_stage::text AS stage,
        COUNT(DISTINCT a.opportunity_id)::integer AS volume
      FROM activities a
      INNER JOIN cohort ON cohort.id = a.opportunity_id
      WHERE a.deleted_at IS NULL
        AND a.event_type IN ('opportunity.created', 'opportunity.stage_changed')
        AND a.to_stage IS NOT NULL
      GROUP BY a.to_stage
    ),
    exits AS (
      SELECT
        a.from_stage::text AS stage,
        (COUNT(DISTINCT a.opportunity_id) FILTER (
          WHERE CASE a.to_stage::text
            WHEN 'new' THEN 1
            WHEN 'curation' THEN 2
            WHEN 'proposal' THEN 3
            WHEN 'negotiation' THEN 4
            WHEN 'won' THEN 5
            ELSE 0
          END > CASE a.from_stage::text
            WHEN 'new' THEN 1
            WHEN 'curation' THEN 2
            WHEN 'proposal' THEN 3
            WHEN 'negotiation' THEN 4
            WHEN 'won' THEN 5
            ELSE 0
          END
        ))::integer AS progressed,
        (COUNT(DISTINCT a.opportunity_id) FILTER (WHERE a.to_stage = 'lost'))::integer AS drop_off
      FROM activities a
      INNER JOIN cohort ON cohort.id = a.opportunity_id
      WHERE a.deleted_at IS NULL
        AND a.event_type = 'opportunity.stage_changed'
        AND a.from_stage IS NOT NULL
      GROUP BY a.from_stage
    ),
    stage_order(stage, position) AS (
      VALUES ('new', 1), ('curation', 2), ('proposal', 3), ('negotiation', 4), ('won', 5)
    )
    SELECT
      stage_order.stage,
      COALESCE(reached.volume, 0)::integer AS volume,
      COALESCE(exits.progressed, 0)::integer AS progressed,
      COALESCE(exits.drop_off, 0)::integer AS drop_off
    FROM stage_order
    LEFT JOIN reached USING (stage)
    LEFT JOIN exits USING (stage)
    ORDER BY stage_order.position
  `)

  const mapped = rows.map((row) => {
    const stage = stringFromRow(row.stage) as Exclude<OpportunityStage, 'lost'>
    const volume = numberFromRow(row.volume)
    const progressed = numberFromRow(row.progressed)
    const dropOff = numberFromRow(row.drop_off)
    return {
      stage,
      volume,
      progressed,
      dropOff,
      conversionToNext: safeRatio(progressed, volume),
      dropOffRate: safeRatio(dropOff, volume),
    }
  })
  const won = mapped.find((row) => row.stage === 'won')?.volume || 0
  const lost = await getCohortLossCount(payload, filters)

  return {
    stages: mapped,
    lost,
    terminalConversionRate: safeRatio(won, won + lost),
    historySource: 'activities',
  }
}

async function getCohortLossCount(payload: Payload, filters: NormalizedReportingFilters) {
  const cohortWhere = createdOpportunityWhere(filters)
  const rows = await runReportingQuery(payload, 'funnel.losses', sql`
    SELECT COUNT(DISTINCT a.opportunity_id)::integer AS loss_count
    FROM activities a
    INNER JOIN opportunities o ON o.id = a.opportunity_id
    WHERE ${cohortWhere}
      AND a.deleted_at IS NULL
      AND a.to_stage = 'lost'
      AND a.event_type IN ('opportunity.created', 'opportunity.stage_changed')
  `)
  return numberFromRow(rows[0]?.loss_count)
}

export async function getCurrentPipelineSnapshot(
  payload: Payload,
  filters: NormalizedReportingFilters,
): Promise<CurrentPipelineStage[]> {
  const where = currentOpenOpportunityWhere(filters)
  const rows = await runReportingQuery(payload, 'funnel.current-pipeline', sql`
    SELECT o.stage::text AS stage, COUNT(*)::integer AS stage_count
    FROM opportunities o
    WHERE ${where}
    GROUP BY o.stage
  `)
  const counts = new Map(
    rows
      .map((row) => [stringFromRow(row.stage), numberFromRow(row.stage_count)] as const)
      .filter(([stage]) => isOpenStage(stage)),
  )

  return openOpportunityStages.map((stage) => ({
    stage,
    volume: counts.get(stage) || 0,
  }))
}
