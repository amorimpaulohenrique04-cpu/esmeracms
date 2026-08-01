import { sql, type SQL } from '@payloadcms/db-postgres/drizzle'
import type { Payload } from 'payload'

import { opportunityStageLabels, opportunityStages } from '../../businessRules/opportunities/stages'
import { nullableNumberFromRow, runReportingQuery, stringFromRow } from './db'
import {
  closedOpportunityWhere,
  createdOpportunityWhere,
  nativeWonCycleWhere,
  salesWhere,
} from './filters'
import type { NormalizedReportingFilters } from './metrics'

export const reportingDrilldownKinds = [
  'opportunities',
  'conversion',
  'sales',
  'cycle',
  'funnel-stage',
  'loss-reason',
  'source',
  'product',
  'category',
  'owner',
] as const

export type ReportingDrilldownKind = (typeof reportingDrilldownKinds)[number]

export type ReportingDrilldownRecord = {
  key: string
  entity: 'opportunity' | 'sale'
  title: string
  meta: string
  status: string
  amountCents: number | null
  occurredAt: string | null
  href: string
}

export type ReportingDrilldown = {
  kind: ReportingDrilldownKind
  value: string | null
  title: string
  description: string
  records: ReportingDrilldownRecord[]
  truncated: boolean
}

function recordsFromRows(rows: Record<string, unknown>[]) {
  return rows.slice(0, 100).map((row) => {
    const entity = stringFromRow(row.entity) === 'sale' ? 'sale' : 'opportunity'
    const id = stringFromRow(row.record_id)
    return {
      key: `${entity}:${id}`,
      entity,
      title: stringFromRow(row.title, entity === 'sale' ? 'Venda' : 'Oportunidade'),
      meta: stringFromRow(row.meta, 'Sem contexto adicional'),
      status: stringFromRow(row.status, '—'),
      amountCents: nullableNumberFromRow(row.amount_cents),
      occurredAt: row.occurred_at ? stringFromRow(row.occurred_at) : null,
      href: stringFromRow(
        row.href,
        entity === 'sale'
          ? `/admin/collections/sales/${id}`
          : `/admin/collections/opportunities/${id}`,
      ),
    } satisfies ReportingDrilldownRecord
  })
}

function opportunityRecordSelect(where: SQL, extra: SQL = sql``) {
  return sql`
    SELECT
      'opportunity'::text AS entity,
      o.id::text AS record_id,
      COALESCE(o.code, 'Oportunidade #' || o.id::text) AS title,
      COALESCE(customer.name, 'Sem cliente') || ' · ' || COALESCE(o.source::text, 'sem origem') AS meta,
      o.stage::text AS status,
      o.estimated_value_cents::bigint AS amount_cents,
      COALESCE(o.closed_at, o.created_at) AS occurred_at,
      '/admin/collections/opportunities/' || o.id::text AS href
    FROM opportunities o
    LEFT JOIN customers customer ON customer.id = o.customer_id
    WHERE ${where}
      ${extra}
    ORDER BY COALESCE(o.closed_at, o.created_at) DESC
    LIMIT 101
  `
}

function saleRecordSelect(where: SQL, extra: SQL = sql``) {
  return sql`
    SELECT
      'sale'::text AS entity,
      s.id::text AS record_id,
      'Venda #' || COALESCE(s.number, s.id::text) AS title,
      COALESCE(customer.name, 'Sem cliente') || ' · ' || COALESCE(s.channel::text, 'sem canal') AS meta,
      s.status::text AS status,
      s.total_cents::bigint AS amount_cents,
      s.confirmed_at AS occurred_at,
      '/admin/collections/sales/' || s.id::text AS href
    FROM sales s
    LEFT JOIN customers customer ON customer.id = s.customer_id
    WHERE ${where}
      ${extra}
    ORDER BY s.confirmed_at DESC
    LIMIT 101
  `
}

function labelFor(kind: ReportingDrilldownKind, value: string | null) {
  if (kind === 'opportunities') return ['Oportunidades criadas', 'Registros nativos criados no período e nos filtros atuais.']
  if (kind === 'conversion') return ['Oportunidades encerradas', 'Base real usada para o cálculo de conversão: ganho e perdido.']
  if (kind === 'sales') return ['Vendas válidas', 'Transações com confirmedAt no período e status elegível.']
  if (kind === 'cycle') return ['Ciclo de venda', 'Oportunidades nativas ganhas usadas no cálculo do ciclo médio.']
  if (kind === 'funnel-stage') return [`Etapa ${opportunityStageLabels[value as keyof typeof opportunityStageLabels] || value || '—'}`, 'Oportunidades da coorte que alcançaram esta etapa segundo Activities.']
  if (kind === 'loss-reason') return [`Perdas · ${value || 'outro'}`, 'Oportunidades perdidas com o motivo estruturado selecionado.']
  if (kind === 'source') return [`Origem · ${value || 'não atribuída'}`, 'Oportunidades criadas na origem selecionada.']
  if (kind === 'product') return ['Produto', 'Oportunidades interessadas e vendas válidas relacionadas ao produto.']
  if (kind === 'category') return ['Categoria', 'Oportunidades interessadas e vendas válidas relacionadas à categoria.']
  return ['Responsável', 'Oportunidades criadas e vendas válidas atribuídas ao responsável.']
}

export async function getReportingDrilldown(
  payload: Payload,
  filters: NormalizedReportingFilters,
  kind: ReportingDrilldownKind,
  value: string | null = null,
): Promise<ReportingDrilldown> {
  const createdWhere = createdOpportunityWhere(filters)
  const closedWhere = closedOpportunityWhere(filters)
  const validSaleWhere = salesWhere(filters)
  let rows: Record<string, unknown>[]

  if (kind === 'opportunities') {
    rows = await runReportingQuery(payload, 'drilldown.opportunities', opportunityRecordSelect(createdWhere))
  } else if (kind === 'conversion') {
    rows = await runReportingQuery(payload, 'drilldown.conversion', opportunityRecordSelect(closedWhere))
  } else if (kind === 'cycle') {
    rows = await runReportingQuery(payload, 'drilldown.cycle', opportunityRecordSelect(nativeWonCycleWhere(filters)))
  } else if (kind === 'sales') {
    rows = await runReportingQuery(payload, 'drilldown.sales', saleRecordSelect(validSaleWhere))
  } else if (kind === 'funnel-stage') {
    const stage = opportunityStages.includes(value as typeof opportunityStages[number]) ? value : null
    if (!stage) rows = []
    else rows = await runReportingQuery(payload, 'drilldown.funnel-stage', sql`
      WITH cohort AS (
        SELECT o.id
        FROM opportunities o
        WHERE ${createdWhere}
      ),
      reached AS (
        SELECT DISTINCT a.opportunity_id
        FROM activities a
        INNER JOIN cohort ON cohort.id = a.opportunity_id
        WHERE a.deleted_at IS NULL
          AND a.event_type IN ('opportunity.created', 'opportunity.stage_changed')
          AND a.to_stage = ${stage}
      )
      SELECT
        'opportunity'::text AS entity,
        o.id::text AS record_id,
        COALESCE(o.code, 'Oportunidade #' || o.id::text) AS title,
        COALESCE(customer.name, 'Sem cliente') || ' · etapa atual ' || o.stage::text AS meta,
        o.stage::text AS status,
        o.estimated_value_cents::bigint AS amount_cents,
        COALESCE(o.closed_at, o.created_at) AS occurred_at,
        '/admin/collections/opportunities/' || o.id::text AS href
      FROM reached
      INNER JOIN opportunities o ON o.id = reached.opportunity_id
      LEFT JOIN customers customer ON customer.id = o.customer_id
      ORDER BY COALESCE(o.closed_at, o.created_at) DESC
      LIMIT 101
    `)
  } else if (kind === 'loss-reason') {
    rows = await runReportingQuery(payload, 'drilldown.loss-reason', opportunityRecordSelect(
      closedWhere,
      sql`AND o.stage = 'lost' AND COALESCE(o.loss_reason::text, 'other') = ${value || 'other'}`,
    ))
  } else if (kind === 'source') {
    rows = await runReportingQuery(payload, 'drilldown.source', opportunityRecordSelect(
      createdWhere,
      sql`AND COALESCE(o.source::text, 'other') = ${value || 'other'}`,
    ))
  } else if (kind === 'product') {
    rows = await runReportingQuery(payload, 'drilldown.product', sql`
      (
        ${opportunityRecordSelect(createdWhere, sql`AND EXISTS (
          SELECT 1 FROM opportunities_rels interest
          WHERE interest.parent_id = o.id
            AND interest.path = 'interestedProducts'
            AND interest.products_id = ${value}
        )`)}
      )
      UNION ALL
      (
        ${saleRecordSelect(validSaleWhere, sql`AND EXISTS (
          SELECT 1 FROM sales_items item
          WHERE item._parent_id = s.id
            AND item.product_id = ${value}
        )`)}
      )
      ORDER BY occurred_at DESC
      LIMIT 101
    `)
  } else if (kind === 'category') {
    rows = await runReportingQuery(payload, 'drilldown.category', sql`
      (
        ${opportunityRecordSelect(createdWhere, sql`AND EXISTS (
          SELECT 1
          FROM opportunities_rels interest
          INNER JOIN products_rels category_relation
            ON category_relation.parent_id = interest.products_id
           AND category_relation.path = 'categories'
          WHERE interest.parent_id = o.id
            AND interest.path = 'interestedProducts'
            AND category_relation.categories_id = ${value}
        )`)}
      )
      UNION ALL
      (
        ${saleRecordSelect(validSaleWhere, sql`AND EXISTS (
          SELECT 1
          FROM sales_items item
          INNER JOIN products_rels category_relation
            ON category_relation.parent_id = item.product_id
           AND category_relation.path = 'categories'
          WHERE item._parent_id = s.id
            AND category_relation.categories_id = ${value}
        )`)}
      )
      ORDER BY occurred_at DESC
      LIMIT 101
    `)
  } else {
    rows = await runReportingQuery(payload, 'drilldown.owner', sql`
      (
        ${opportunityRecordSelect(createdWhere, sql`AND o.owner_id = ${value}`)}
      )
      UNION ALL
      (
        ${saleRecordSelect(validSaleWhere, sql`AND s.owner_id = ${value}`)}
      )
      ORDER BY occurred_at DESC
      LIMIT 101
    `)
  }

  const [title, description] = labelFor(kind, value)
  return {
    kind,
    value,
    title,
    description,
    records: recordsFromRows(rows),
    truncated: rows.length > 100,
  }
}

export function isReportingDrilldownKind(value: unknown): value is ReportingDrilldownKind {
  return reportingDrilldownKinds.includes(value as ReportingDrilldownKind)
}
