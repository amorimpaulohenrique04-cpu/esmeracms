import { describe, expect, it } from 'vitest'

import { findCustomerDuplicateMatches } from '../../src/businessRules/customers/dedupe'
import { normalizeCustomerEmail, normalizeCustomerPhone } from '../../src/businessRules/customers/normalization'
import { canTransitionOpportunity } from '../../src/businessRules/opportunities/stages'
import { getProductReadiness } from '../../src/businessRules/products/readiness'
import { calculateSaleFinancials } from '../../src/businessRules/sales/financials'
import {
  AdminRequestError,
  adminErrorCodeFromStatus,
  assertFiniteMetric,
  finiteMetric,
  normalizeAdminError,
} from '../../src/admin/state/asyncState'
import { metricDelta, safeRatio } from '../../src/server/reporting/metrics'
import { sortCommercialRanking } from '../../src/server/reporting/ranking'

describe('Stage 20 mandatory domain contracts', () => {
  it('keeps product readiness server-side and rejects incomplete drafts', () => {
    expect(getProductReadiness({ title: 'Rascunho' }).ready).toBe(false)

    const complete = getProductReadiness({
      title: 'Objeto Esméra',
      slug: 'objeto-esmera',
      code: 'ESM-001',
      categories: [1],
      catalogStatus: 'active',
      availability: 'unique',
      priceMode: 'fixed',
      basePriceCents: 145_000,
      gallery: [{ image: 1, mediaKey: 'cover', role: 'cover', alt: 'Objeto em esmeralda' }],
      optionDefinitions: [],
      variants: [],
    })

    expect(complete).toEqual({ ready: true, issues: [] })
  })

  it('allows only explicit opportunity transitions', () => {
    expect(canTransitionOpportunity('new', 'curation')).toBe(true)
    expect(canTransitionOpportunity('proposal', 'won')).toBe(true)
    expect(canTransitionOpportunity('new', 'won')).toBe(false)
    expect(canTransitionOpportunity('won', 'negotiation')).toBe(false)
  })

  it('calculates sale values only as integer cents', () => {
    expect(calculateSaleFinancials({
      items: [
        { priceMode: 'fixed', unitPriceCents: 100_000, quantity: 2 },
        { priceMode: 'fixed', unitPriceCents: 25_000, quantity: 1 },
      ],
      discountCents: 10_000,
      shippingCents: 5_000,
    })).toEqual({ subtotalCents: 225_000, totalCents: 220_000, issues: [] })

    expect(calculateSaleFinancials({
      items: [{ priceMode: 'fixed', unitPriceCents: 100.5, quantity: 1 }],
    }).totalCents).toBeNull()
  })

  it('normalizes email and phone identities deterministically', () => {
    expect(normalizeCustomerEmail('  MARIA@EXAMPLE.COM ')).toBe('maria@example.com')
    expect(normalizeCustomerPhone('(81) 99999-0000')).toBe('+5581999990000')
    expect(normalizeCustomerPhone('+1 (212) 555-0100')).toBe('+12125550100')
  })

  it('detects duplicates without matching the same record', () => {
    const matches = findCustomerDuplicateMatches(
      { id: 10, name: 'Mariana Lopes', company: 'Atelier', email: 'MARIANA@example.com', phone: '(81) 99999-0000' },
      [
        { id: 10, name: 'Mariana Lopes', company: 'Atelier', email: 'mariana@example.com', phone: '+5581999990000' },
        { id: 11, name: 'Maríana Lopes', company: 'Atelier', email: 'mariana@example.com' },
        { id: 12, name: 'Outra Pessoa', company: 'Outro', phone: '+5581999990000' },
      ],
    )

    expect(matches).toEqual([
      { id: 11, reasons: ['email', 'name-company'] },
      { id: 12, reasons: ['phone'] },
    ])
  })

  it('never creates NaN or fake zero for metrics without a denominator', () => {
    expect(safeRatio(1, 0)).toBeNull()
    expect(safeRatio(Number.NaN, 2)).toBeNull()
    expect(metricDelta(100, 0)).toEqual({ absolute: 100, percentage: null })
    expect(finiteMetric(Number.NaN)).toBeNull()
    expect(() => assertFiniteMetric(Number.POSITIVE_INFINITY, 'Receita')).toThrow('Receita não possui um valor numérico válido.')
  })

  it('ranks commercial rows by revenue, volume and stable name order', () => {
    const ranked = sortCommercialRanking([
      { ownerName: 'Zélia', revenueCents: 100_000, opportunitiesCreated: 5 },
      { ownerName: 'Ana', revenueCents: 200_000, opportunitiesCreated: 2 },
      { ownerName: 'Bruno', revenueCents: 100_000, opportunitiesCreated: 8 },
      { ownerName: 'Alice', revenueCents: 100_000, opportunitiesCreated: 8 },
    ])

    expect(ranked.map((row) => row.ownerName)).toEqual(['Ana', 'Alice', 'Bruno', 'Zélia'])
  })

  it('maps HTTP and mutation failures to the shared error contract', () => {
    expect(adminErrorCodeFromStatus(401)).toBe('unauthorized')
    expect(adminErrorCodeFromStatus(403)).toBe('forbidden')
    expect(adminErrorCodeFromStatus(404)).toBe('not_found')
    expect(adminErrorCodeFromStatus(409, 'duplicate')).toBe('duplicate')
    expect(adminErrorCodeFromStatus(500)).toBe('query_error')

    const normalized = normalizeAdminError(new AdminRequestError({
      code: 'mutation_rollback',
      message: 'A alteração foi revertida.',
      status: 409,
      retryable: true,
    }))
    expect(normalized).toMatchObject({ code: 'mutation_rollback', status: 409, retryable: true })
  })
})
