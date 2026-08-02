import { opportunityReportingCutoverAt } from '../../businessRules/opportunities/stages'

export const REPORTING_SEMANTIC_VERSION = '2026-08-01.1'
export const REPORTING_TIME_ZONE = 'America/Recife'

export const VALID_SALE_STATUSES = ['confirmed', 'production', 'ready', 'delivered'] as const

export type ValidSaleStatus = (typeof VALID_SALE_STATUSES)[number]

export type ReportingPeriod = {
  from: string
  to: string
}

export type ComparisonMode = 'previous_period' | 'previous_year' | null

export type ReportingFilters = {
  period?: Partial<ReportingPeriod>
  compareWith?: ComparisonMode
  ownerId?: number | string | null
  source?: string | null
  categoryId?: number | string | null
  productId?: number | string | null
}

export type NormalizedReportingFilters = {
  period: ReportingPeriod
  compareWith: ComparisonMode
  ownerId: number | string | null
  source: string | null
  categoryId: number | string | null
  productId: number | string | null
}

export type CommercialMetricSnapshot = {
  opportunitiesCreated: number
  wonOpportunities: number
  lostOpportunities: number
  validSales: number
  revenueCents: number
  conversionRate: number | null
  averageTicketCents: number | null
  averageSalesCycleDays: number | null
}

export type MetricDelta = {
  absolute: number | null
  percentage: number | null
}

export type CommercialMetricComparison = {
  current: CommercialMetricSnapshot
  previous: CommercialMetricSnapshot | null
  delta: {
    opportunitiesCreated: MetricDelta
    validSales: MetricDelta
    revenueCents: MetricDelta
    conversionRate: MetricDelta
    averageTicketCents: MetricDelta
    averageSalesCycleDays: MetricDelta
  }
}

export const METRIC_CONTRACT = {
  opportunitiesCreated: {
    label: 'Oportunidades criadas',
    source: 'opportunities',
    dateField: 'createdAt',
    definition: 'Oportunidades nativas criadas no período. Registros gerados pela migração de Leads não são contados como nova aquisição comercial.',
  },
  validSales: {
    label: 'Vendas válidas',
    source: 'sales',
    dateField: 'confirmedAt',
    definition: `Vendas com confirmedAt no período e status em ${VALID_SALE_STATUSES.join(', ')}.`,
  },
  revenueCents: {
    label: 'Receita',
    source: 'sales.totalCents',
    dateField: 'confirmedAt',
    definition: 'Soma de totalCents das mesmas vendas consideradas válidas. Valores permanecem em centavos no servidor.',
  },
  conversionRate: {
    label: 'Conversão',
    source: 'opportunities',
    dateField: 'closedAt',
    definition: 'Oportunidades ganhas divididas pelas oportunidades encerradas como ganhas ou perdidas na janela efetiva do funil.',
  },
  averageTicketCents: {
    label: 'Ticket médio',
    source: 'sales.totalCents',
    dateField: 'confirmedAt',
    definition: 'Média de totalCents das vendas válidas com valor conhecido.',
  },
  averageSalesCycleDays: {
    label: 'Ciclo de venda',
    source: 'opportunities.createdAt + opportunities.closedAt',
    dateField: 'closedAt',
    definition: 'Média, em dias, entre createdAt e closedAt das oportunidades nativas ganhas. Migrações sem início comercial verificável são excluídas.',
  },
} as const

export type MetricContractKey = keyof typeof METRIC_CONTRACT

export function reportingOpportunityCutoverAt() {
  return opportunityReportingCutoverAt()
}

export function safeRatio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null
  return numerator / denominator
}

export function roundMetric(value: number | null, precision = 2): number | null {
  if (value === null || !Number.isFinite(value)) return null
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

export function metricDelta(current: number | null, previous: number | null): MetricDelta {
  if (current === null || previous === null || !Number.isFinite(current) || !Number.isFinite(previous)) {
    return { absolute: null, percentage: null }
  }

  const absolute = current - previous
  return {
    absolute,
    percentage: previous === 0 ? null : absolute / Math.abs(previous),
  }
}

export function buildMetricComparison(
  current: CommercialMetricSnapshot,
  previous: CommercialMetricSnapshot | null,
): CommercialMetricComparison {
  return {
    current,
    previous,
    delta: {
      opportunitiesCreated: metricDelta(current.opportunitiesCreated, previous?.opportunitiesCreated ?? null),
      validSales: metricDelta(current.validSales, previous?.validSales ?? null),
      revenueCents: metricDelta(current.revenueCents, previous?.revenueCents ?? null),
      conversionRate: metricDelta(current.conversionRate, previous?.conversionRate ?? null),
      averageTicketCents: metricDelta(current.averageTicketCents, previous?.averageTicketCents ?? null),
      averageSalesCycleDays: metricDelta(current.averageSalesCycleDays, previous?.averageSalesCycleDays ?? null),
    },
  }
}
