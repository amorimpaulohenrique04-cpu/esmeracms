import type { Payload } from 'payload'

import { normalizeReportingFilters } from '../filters'
import type {
  NormalizedReportingFilters,
  ReportingFilters,
} from '../metrics'
import type { ReportingSnapshot } from '..'
import {
  renderReportingPDF,
  type ReportExportIdentity,
  type ReportFilterLabels,
} from './pdf'

export * from './pdf'

export const REPORT_EXPORT_SYNC_MAX_DAYS = 93
export const REPORT_EXPORT_SYNC_MAX_ROWS = 350

const sourceLabels: Record<string, string> = {
  instagram: 'Instagram',
  referral: 'Indicação',
  site: 'Site',
  architect: 'Arquiteto',
  organic: 'Orgânico',
  whatsapp: 'WhatsApp',
  other: 'Outro',
  unattributed: 'Não atribuída',
}

export type ReportExportDelivery = 'sync' | 'job'
export type ReportExportStatus = 'queued' | 'processing' | 'ready' | 'failed'

export function normalizedExportFilters(input: ReportingFilters = {}) {
  return normalizeReportingFilters(input)
}

export function reportPeriodDays(filters: NormalizedReportingFilters) {
  const from = new Date(filters.period.from).getTime()
  const to = new Date(filters.period.to).getTime()
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 0
  return Math.floor((to - from) / 86_400_000) + 1
}

export function estimateReportRows(snapshot: ReportingSnapshot) {
  return snapshot.evolution.current.length +
    (snapshot.evolution.previous?.length || 0) +
    snapshot.funnel.stages.length +
    snapshot.sources.length +
    snapshot.losses.length +
    snapshot.products.length +
    snapshot.categories.length +
    snapshot.team.length
}

export function shouldQueueBeforeSnapshot(filters: NormalizedReportingFilters) {
  return reportPeriodDays(filters) > REPORT_EXPORT_SYNC_MAX_DAYS
}

export function shouldQueueAfterSnapshot(snapshot: ReportingSnapshot) {
  return estimateReportRows(snapshot) > REPORT_EXPORT_SYNC_MAX_ROWS
}

function filenameDate(value: string) {
  const date = new Date(value)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Recife',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
  return parts.replace(/-/g, '')
}

export function reportExportFilename(filters: NormalizedReportingFilters, generatedAt = new Date().toISOString()) {
  return `esmera-relatorio-${filenameDate(filters.period.from)}-${filenameDate(filters.period.to)}-${filenameDate(generatedAt)}.pdf`
}

async function relationshipLabel(
  payload: Payload,
  collection: 'users' | 'products' | 'categories',
  id: string | number | null,
) {
  if (id === null) return null
  try {
    const document = await payload.findByID({
      collection,
      id,
      depth: 0,
      overrideAccess: true,
      select: collection === 'users'
        ? { name: true, email: true }
        : { title: true, code: true },
    } as never) as unknown as {
      name?: string | null
      email?: string | null
      title?: string | null
      code?: string | null
    }
    return document.name || document.title || document.email || document.code || String(id)
  } catch {
    return String(id)
  }
}

export async function resolveReportFilterLabels(
  payload: Payload,
  filters: NormalizedReportingFilters,
): Promise<ReportFilterLabels> {
  const [owner, category, product] = await Promise.all([
    relationshipLabel(payload, 'users', filters.ownerId),
    relationshipLabel(payload, 'categories', filters.categoryId),
    relationshipLabel(payload, 'products', filters.productId),
  ])

  return {
    comparison: filters.compareWith === 'previous_period'
      ? 'Período anterior'
      : filters.compareWith === 'previous_year'
        ? 'Mesmo período no ano anterior'
        : 'Sem comparação',
    owner: owner || 'Todos',
    source: filters.source ? sourceLabels[filters.source] || filters.source : 'Todas',
    category: category || 'Todas',
    product: product || 'Todos',
  }
}

export function generateReportingPDF(input: {
  snapshot: ReportingSnapshot
  identity: ReportExportIdentity
  filterLabels: ReportFilterLabels
  exportedAt?: string
}) {
  return renderReportingPDF({
    ...input,
    exportedAt: input.exportedAt || new Date().toISOString(),
  })
}
