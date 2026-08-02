import { sql, type SQL } from '@payloadcms/db-postgres/drizzle'

import { openOpportunityStages } from '../../businessRules/opportunities/stages'
import {
  REPORTING_TIME_ZONE,
  VALID_SALE_STATUSES,
  reportingOpportunityCutoverAt,
  type NormalizedReportingFilters,
  type ReportingFilters,
  type ReportingPeriod,
} from './metrics'

const RECIFE_UTC_OFFSET_HOURS = 3

function normalizeDate(value: string | undefined, fallback: Date): string {
  if (!value) return fallback.toISOString()
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) throw new Error(`Período inválido: ${value}`)
  return parsed.toISOString()
}

function localMonthParts(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: REPORTING_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now)

  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  if (!year || !month) throw new Error('Não foi possível determinar o período mensal de relatórios.')
  return { year, month }
}

export function monthToDatePeriod(now = new Date()): ReportingPeriod {
  const { year, month } = localMonthParts(now)
  const from = new Date(Date.UTC(year, month - 1, 1, RECIFE_UTC_OFFSET_HOURS, 0, 0, 0))
  return { from: from.toISOString(), to: now.toISOString() }
}

export function normalizeReportingFilters(
  input: ReportingFilters = {},
  now = new Date(),
): NormalizedReportingFilters {
  const defaultPeriod = monthToDatePeriod(now)
  const from = normalizeDate(input.period?.from, new Date(defaultPeriod.from))
  const to = normalizeDate(input.period?.to, now)

  if (new Date(from).getTime() > new Date(to).getTime()) {
    throw new Error('O início do período não pode ser posterior ao fim.')
  }

  return {
    period: { from, to },
    compareWith: input.compareWith ?? null,
    ownerId: input.ownerId ?? null,
    source: input.source?.trim() || null,
    categoryId: input.categoryId ?? null,
    productId: input.productId ?? null,
  }
}

export function comparisonPeriod(filters: NormalizedReportingFilters): ReportingPeriod | null {
  if (!filters.compareWith) return null

  const from = new Date(filters.period.from)
  const to = new Date(filters.period.to)

  if (filters.compareWith === 'previous_year') {
    const previousFrom = new Date(from)
    const previousTo = new Date(to)
    previousFrom.setUTCFullYear(previousFrom.getUTCFullYear() - 1)
    previousTo.setUTCFullYear(previousTo.getUTCFullYear() - 1)
    return { from: previousFrom.toISOString(), to: previousTo.toISOString() }
  }

  const durationMs = Math.max(1, to.getTime() - from.getTime())
  const previousTo = new Date(from.getTime() - 1)
  const previousFrom = new Date(previousTo.getTime() - durationMs)
  return { from: previousFrom.toISOString(), to: previousTo.toISOString() }
}

export function filtersForPeriod(
  filters: NormalizedReportingFilters,
  period: ReportingPeriod,
): NormalizedReportingFilters {
  return { ...filters, period, compareWith: null }
}

export function effectiveOpportunityPeriod(filters: NormalizedReportingFilters): ReportingPeriod {
  const cutover = reportingOpportunityCutoverAt()
  const from = new Date(filters.period.from).getTime() >= new Date(cutover).getTime()
    ? filters.period.from
    : cutover
  return { from, to: filters.period.to }
}

function sqlList(values: readonly string[]) {
  return sql.join(values.map((value) => sql`${value}`), sql`, `)
}

function opportunityRelationshipFilters(filters: NormalizedReportingFilters): SQL[] {
  const clauses: SQL[] = []

  if (filters.productId !== null) {
    clauses.push(sql`EXISTS (
      SELECT 1
      FROM opportunities_rels product_interest
      WHERE product_interest.parent_id = o.id
        AND product_interest.path = 'interestedProducts'
        AND product_interest.products_id = ${filters.productId}
    )`)
  }

  if (filters.categoryId !== null) {
    clauses.push(sql`EXISTS (
      SELECT 1
      FROM opportunities_rels category_interest
      INNER JOIN products_rels category_relation
        ON category_relation.parent_id = category_interest.products_id
       AND category_relation.path = 'categories'
      WHERE category_interest.parent_id = o.id
        AND category_interest.path = 'interestedProducts'
        AND category_relation.categories_id = ${filters.categoryId}
    )`)
  }

  return clauses
}

function opportunityBaseFilters(filters: NormalizedReportingFilters): SQL[] {
  const clauses: SQL[] = []
  if (filters.ownerId !== null) clauses.push(sql`o.owner_id = ${filters.ownerId}`)
  if (filters.source) clauses.push(sql`o.source = ${filters.source}`)
  clauses.push(...opportunityRelationshipFilters(filters))
  return clauses
}

export function createdOpportunityWhere(filters: NormalizedReportingFilters): SQL {
  const clauses = [
    ...opportunityBaseFilters(filters),
    sql`o.migration_version IS NULL`,
    sql`o.created_at >= ${filters.period.from}::timestamptz`,
    sql`o.created_at <= ${filters.period.to}::timestamptz`,
  ]
  return sql.join(clauses, sql` AND `)
}

export function closedOpportunityWhere(filters: NormalizedReportingFilters): SQL {
  const period = effectiveOpportunityPeriod(filters)
  const clauses = [
    ...opportunityBaseFilters(filters),
    sql`o.closed_at IS NOT NULL`,
    sql`o.closed_at >= ${period.from}::timestamptz`,
    sql`o.closed_at <= ${period.to}::timestamptz`,
    sql`o.stage IN ('won', 'lost')`,
  ]
  return sql.join(clauses, sql` AND `)
}

export function nativeWonCycleWhere(filters: NormalizedReportingFilters): SQL {
  const clauses = [
    closedOpportunityWhere(filters),
    sql`o.stage = 'won'`,
    sql`o.migration_version IS NULL`,
    sql`o.closed_at >= o.created_at`,
  ]
  return sql.join(clauses, sql` AND `)
}

export function currentOpenOpportunityWhere(filters: NormalizedReportingFilters): SQL {
  const clauses = opportunityBaseFilters(filters)
  clauses.push(sql`o.stage IN (${sqlList(openOpportunityStages)})`)
  return sql.join(clauses, sql` AND `)
}

function salesRelationshipFilters(filters: NormalizedReportingFilters): SQL[] {
  const clauses: SQL[] = []

  if (filters.source) {
    clauses.push(sql`EXISTS (
      SELECT 1
      FROM opportunities sale_opportunity
      WHERE sale_opportunity.id = s.opportunity_id
        AND sale_opportunity.source = ${filters.source}
    )`)
  }

  if (filters.productId !== null) {
    clauses.push(sql`EXISTS (
      SELECT 1
      FROM sales_items filtered_item
      WHERE filtered_item._parent_id = s.id
        AND filtered_item.product_id = ${filters.productId}
    )`)
  }

  if (filters.categoryId !== null) {
    clauses.push(sql`EXISTS (
      SELECT 1
      FROM sales_items category_item
      INNER JOIN products_rels category_relation
        ON category_relation.parent_id = category_item.product_id
       AND category_relation.path = 'categories'
      WHERE category_item._parent_id = s.id
        AND category_relation.categories_id = ${filters.categoryId}
    )`)
  }

  return clauses
}

export function salesWhere(filters: NormalizedReportingFilters): SQL {
  const clauses: SQL[] = [
    sql`s.deleted_at IS NULL`,
    sql`s.confirmed_at IS NOT NULL`,
    sql`s.confirmed_at >= ${filters.period.from}::timestamptz`,
    sql`s.confirmed_at <= ${filters.period.to}::timestamptz`,
    sql`s.status IN (${sqlList(VALID_SALE_STATUSES)})`,
  ]

  if (filters.ownerId !== null) clauses.push(sql`s.owner_id = ${filters.ownerId}`)
  clauses.push(...salesRelationshipFilters(filters))
  return sql.join(clauses, sql` AND `)
}

export function leadAcquisitionWhere(filters: NormalizedReportingFilters): SQL {
  const clauses: SQL[] = [
    sql`l.deleted_at IS NULL`,
    sql`l.created_at >= ${filters.period.from}::timestamptz`,
    sql`l.created_at <= ${filters.period.to}::timestamptz`,
  ]
  if (filters.ownerId !== null) clauses.push(sql`l.owner_id = ${filters.ownerId}`)
  if (filters.source) clauses.push(sql`l.source = ${filters.source}`)
  if (filters.productId !== null) {
    clauses.push(sql`EXISTS (
      SELECT 1
      FROM leads_rels product_interest
      WHERE product_interest.parent_id = l.id
        AND product_interest.path = 'interestedProducts'
        AND product_interest.products_id = ${filters.productId}
    )`)
  }
  if (filters.categoryId !== null) {
    clauses.push(sql`EXISTS (
      SELECT 1
      FROM leads_rels category_interest
      INNER JOIN products_rels category_relation
        ON category_relation.parent_id = category_interest.products_id
       AND category_relation.path = 'categories'
      WHERE category_interest.parent_id = l.id
        AND category_interest.path = 'interestedProducts'
        AND category_relation.categories_id = ${filters.categoryId}
    )`)
  }
  return sql.join(clauses, sql` AND `)
}
