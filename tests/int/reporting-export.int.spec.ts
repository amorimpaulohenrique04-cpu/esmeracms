import { describe, expect, it } from 'vitest'

import type { ReportingSnapshot } from '../../src/server/reporting'
import {
  estimateReportRows,
  generateReportingPDF,
  normalizedExportFilters,
  shouldQueueAfterSnapshot,
  shouldQueueBeforeSnapshot,
} from '../../src/server/reporting/export'

function snapshot(overrides: Partial<ReportingSnapshot> = {}) {
  const filters = normalizedExportFilters({
    period: {
      from: '2026-07-01T03:00:00.000Z',
      to: '2026-07-31T23:59:59.999Z',
    },
  })
  return {
    semanticVersion: 'reporting-v1',
    generatedAt: '2026-08-01T18:00:00.000Z',
    opportunityCutoverAt: '2026-07-01T03:00:00.000Z',
    filters,
    metrics: {
      current: {
        opportunitiesCreated: 12,
        wonOpportunities: 4,
        lostOpportunities: 2,
        validSales: 4,
        revenueCents: 4200000,
        conversionRate: 4 / 6,
        averageTicketCents: 1050000,
        averageSalesCycleDays: 8.5,
      },
      previous: null,
      delta: {
        opportunitiesCreated: { absolute: null, relative: null },
        wonOpportunities: { absolute: null, relative: null },
        lostOpportunities: { absolute: null, relative: null },
        validSales: { absolute: null, relative: null },
        revenueCents: { absolute: null, relative: null },
        conversionRate: { absolute: null, relative: null },
        averageTicketCents: { absolute: null, relative: null },
        averageSalesCycleDays: { absolute: null, relative: null },
      },
    },
    leadAcquisition: { total: 0, sources: [] },
    evolution: {
      current: [{ date: '2026-07-01', leads: 2, opportunities: 1, sales: 1, revenueCents: 1050000 }],
      previous: null,
    },
    channels: [],
    funnel: {
      stages: [{ stage: 'new', volume: 12, conversionToNext: 0.75, dropOff: 3, dropOffRate: 0.25 }],
      terminalConversionRate: 4 / 6,
    },
    sources: [{ source: 'instagram', opportunitiesCreated: 12, wonOpportunities: 4, lostOpportunities: 2, conversionRate: 4 / 6, validSales: 4, revenueCents: 4200000 }],
    products: [{ productId: 1, title: 'Cartografia Verde', opportunitiesCreated: 8, wonOpportunities: 3, lostOpportunities: 1, conversionRate: 0.75, validSales: 3, grossItemRevenueCents: 3600000 }],
    categories: [{ categoryId: 1, title: 'Esculturas', opportunitiesCreated: 8, wonOpportunities: 3, lostOpportunities: 1, conversionRate: 0.75, validSales: 3, grossItemRevenueCents: 3600000 }],
    team: [{ ownerId: 1, ownerName: 'Equipe Comercial', opportunitiesCreated: 12, wonOpportunities: 4, lostOpportunities: 2, conversionRate: 4 / 6, validSales: 4, revenueCents: 4200000, averageTicketCents: 1050000 }],
    losses: [{ reason: 'price', label: 'Preço', volume: 2, shareOfLosses: 1 }],
    performance: {},
    notes: {
      productRevenue: 'Receita bruta por item.',
      categoryOverlap: 'Categorias podem se sobrepor.',
      migratedOpportunities: 'Migradas seguem regra própria.',
    },
    ...overrides,
  } as unknown as ReportingSnapshot
}

describe('report export', () => {
  it('renders a native PDF with semantic and generator metadata', () => {
    const report = snapshot()
    const pdf = generateReportingPDF({
      snapshot: report,
      identity: { id: '1', name: 'Paulo Henrique', email: 'paulo@example.com' },
      filterLabels: {
        comparison: 'Sem comparação',
        owner: 'Todos',
        source: 'Todas',
        category: 'Todas',
        product: 'Todos',
      },
      exportedAt: '2026-08-01T18:30:00.000Z',
    })

    const source = pdf.toString('latin1')
    expect(source.startsWith('%PDF-1.7')).toBe(true)
    expect(source).toContain('/Creator (Esmera Reporting PDF Renderer)')
    expect(source).toContain('/Subject (Contrato semantico reporting-v1)')
    expect(source.trimEnd().endsWith('%%EOF')).toBe(true)
    expect(pdf.byteLength).toBeGreaterThan(2_000)
  })

  it('keeps small exports synchronous and routes heavy exports to Jobs', () => {
    const small = normalizedExportFilters({
      period: { from: '2026-07-01T03:00:00.000Z', to: '2026-07-31T23:59:59.999Z' },
    })
    const long = normalizedExportFilters({
      period: { from: '2026-01-01T03:00:00.000Z', to: '2026-07-31T23:59:59.999Z' },
    })

    expect(shouldQueueBeforeSnapshot(small)).toBe(false)
    expect(shouldQueueBeforeSnapshot(long)).toBe(true)
    expect(estimateReportRows(snapshot())).toBeGreaterThan(0)

    const heavy = snapshot({
      products: Array.from({ length: 360 }, (_, index) => ({
        productId: index + 1,
        title: `Produto ${index + 1}`,
        opportunitiesCreated: 1,
        wonOpportunities: 0,
        lostOpportunities: 0,
        conversionRate: null,
        validSales: 0,
        grossItemRevenueCents: 0,
      })),
    } as Partial<ReportingSnapshot>)
    expect(shouldQueueAfterSnapshot(heavy)).toBe(true)
  })
})
