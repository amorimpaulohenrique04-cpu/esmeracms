import type { Payload, PayloadRequest } from 'payload'

import { canManageBusiness } from '../../access/roles'
import { reportingPerformanceSnapshot } from './db'
import {
  comparisonPeriod,
  filtersForPeriod,
  normalizeReportingFilters,
} from './filters'
import {
  getCurrentPipelineSnapshot,
  getFunnelSnapshot,
  getOpportunityMetrics,
} from './funnel'
import { getLossReasons } from './losses'
import {
  buildMetricComparison,
  REPORTING_SEMANTIC_VERSION,
  reportingOpportunityCutoverAt,
  roundMetric,
  safeRatio,
  type CommercialMetricComparison,
  type CommercialMetricSnapshot,
  type NormalizedReportingFilters,
  type ReportingFilters,
} from './metrics'
import { getCategoryPerformance, getProductPerformance } from './products'
import { getSalesByChannel, getSalesMetrics, getSalesTimeline } from './sales'
import { getLeadAcquisitionBySource, getSourcePerformance } from './sources'
import { getTeamPerformance } from './team'

export * from './filters'
export * from './funnel'
export * from './losses'
export * from './metrics'
export * from './products'
export * from './sales'
export * from './sources'
export * from './team'

export class ReportingAccessError extends Error {
  readonly status = 403

  constructor() {
    super('Seu papel não possui acesso aos relatórios comerciais.')
    this.name = 'ReportingAccessError'
  }
}

function assertReportingAccess(req: PayloadRequest) {
  if (!canManageBusiness(req.user)) throw new ReportingAccessError()
}

async function metricSnapshot(
  payload: Payload,
  filters: NormalizedReportingFilters,
): Promise<CommercialMetricSnapshot> {
  const [sales, opportunities] = await Promise.all([
    getSalesMetrics(payload, filters),
    getOpportunityMetrics(payload, filters),
  ])
  const ended = opportunities.wonOpportunities + opportunities.lostOpportunities

  return {
    opportunitiesCreated: opportunities.opportunitiesCreated,
    wonOpportunities: opportunities.wonOpportunities,
    lostOpportunities: opportunities.lostOpportunities,
    validSales: sales.validSales,
    revenueCents: sales.revenueCents,
    conversionRate: safeRatio(opportunities.wonOpportunities, ended),
    averageTicketCents: sales.averageTicketCents,
    averageSalesCycleDays: roundMetric(opportunities.averageSalesCycleDays),
  }
}

async function metricComparison(
  payload: Payload,
  filters: NormalizedReportingFilters,
): Promise<CommercialMetricComparison> {
  const previousPeriod = comparisonPeriod(filters)
  const [current, previous] = await Promise.all([
    metricSnapshot(payload, filters),
    previousPeriod ? metricSnapshot(payload, filtersForPeriod(filters, previousPeriod)) : Promise.resolve(null),
  ])
  return buildMetricComparison(current, previous)
}

export async function getReportingOverview(
  req: PayloadRequest,
  input: ReportingFilters = {},
) {
  assertReportingAccess(req)
  const filters = normalizeReportingFilters(input)
  const [metrics, leadAcquisition, sources, channels] = await Promise.all([
    metricComparison(req.payload, filters),
    getLeadAcquisitionBySource(req.payload, filters),
    getSourcePerformance(req.payload, filters),
    getSalesByChannel(req.payload, filters),
  ])

  return {
    semanticVersion: REPORTING_SEMANTIC_VERSION,
    generatedAt: new Date().toISOString(),
    opportunityCutoverAt: reportingOpportunityCutoverAt(),
    filters,
    metrics,
    leadAcquisition,
    sources,
    channels,
    performance: reportingPerformanceSnapshot(),
  }
}

export async function getReportingSnapshot(
  req: PayloadRequest,
  input: ReportingFilters = {},
) {
  assertReportingAccess(req)
  const filters = normalizeReportingFilters(input)
  const [
    metrics,
    leadAcquisition,
    timeline,
    channels,
    funnel,
    sources,
    products,
    categories,
    team,
    losses,
  ] = await Promise.all([
    metricComparison(req.payload, filters),
    getLeadAcquisitionBySource(req.payload, filters),
    getSalesTimeline(req.payload, filters),
    getSalesByChannel(req.payload, filters),
    getFunnelSnapshot(req.payload, filters),
    getSourcePerformance(req.payload, filters),
    getProductPerformance(req.payload, filters),
    getCategoryPerformance(req.payload, filters),
    getTeamPerformance(req.payload, filters),
    getLossReasons(req.payload, filters),
  ])

  return {
    semanticVersion: REPORTING_SEMANTIC_VERSION,
    generatedAt: new Date().toISOString(),
    opportunityCutoverAt: reportingOpportunityCutoverAt(),
    filters,
    metrics,
    leadAcquisition,
    timeline,
    channels,
    funnel,
    sources,
    products,
    categories,
    team,
    losses,
    performance: reportingPerformanceSnapshot(),
    notes: {
      productRevenue:
        'Receita por produto e categoria é bruta por item. Desconto e frete no nível da venda não são distribuídos artificialmente.',
      categoryOverlap:
        'Produtos com múltiplas categorias contribuem para cada categoria relacionada; por isso o total das categorias pode superar o total geral.',
      migratedOpportunities:
        'Oportunidades migradas podem participar da conversão quando closedAt é verificável, mas não são contadas como oportunidades criadas nem entram no ciclo médio.',
    },
  }
}

export async function getDashboardReporting(
  req: PayloadRequest,
  input: ReportingFilters = {},
) {
  assertReportingAccess(req)
  const filters = normalizeReportingFilters(input)
  const [sales, pipeline] = await Promise.all([
    getSalesMetrics(req.payload, filters),
    getCurrentPipelineSnapshot(req.payload, filters),
  ])

  return {
    semanticVersion: REPORTING_SEMANTIC_VERSION,
    filters,
    sales,
    pipeline,
    openOpportunities: pipeline.reduce((total, stage) => total + stage.volume, 0),
  }
}
