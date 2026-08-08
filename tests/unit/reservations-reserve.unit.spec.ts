import { describe, expect, it } from 'vitest'

import {
  assessReservation,
  isProductPurchasable,
  isReservationActive,
  isUniquePiece,
  type ReservableProduct,
} from '../../src/server/domain/reservations/reserve'

const NOW = Date.parse('2026-08-08T12:00:00Z')

function product(overrides: Partial<ReservableProduct> = {}): ReservableProduct {
  return {
    id: 42,
    slug: 'ponta-de-esmeralda',
    catalogStatus: 'active',
    status: 'published',
    availability: 'available',
    priceMode: 'fixed',
    basePriceCents: 49000,
    edition: 'Peça única',
    ...overrides,
  }
}

describe('isUniquePiece', () => {
  it('reconhece peça única por edition ou availability legado', () => {
    expect(isUniquePiece(product())).toBe(true)
    expect(isUniquePiece(product({ edition: null, availability: 'unique' }))).toBe(true)
    expect(isUniquePiece(product({ edition: null, availability: 'available' }))).toBe(false)
    expect(isUniquePiece(product({ edition: null, isUnique: true }))).toBe(true)
  })
})

describe('isProductPurchasable', () => {
  it('exige catálogo ativo, publicado, preço fixo e estado comprável', () => {
    expect(isProductPurchasable(product())).toBe(true)
    expect(isProductPurchasable(product({ catalogStatus: 'archived' }))).toBe(false)
    expect(isProductPurchasable(product({ status: 'draft' }))).toBe(false)
    expect(isProductPurchasable(product({ priceMode: 'inquiry', basePriceCents: null }))).toBe(false)
    expect(isProductPurchasable(product({ availability: 'made_to_order' }))).toBe(false)
  })
})

describe('isReservationActive', () => {
  it('confirmada sempre ativa; held só dentro do TTL', () => {
    expect(isReservationActive({ status: 'confirmed' }, NOW)).toBe(true)
    expect(isReservationActive({ status: 'held', reservedUntil: new Date(NOW + 60_000).toISOString() }, NOW)).toBe(true)
    expect(isReservationActive({ status: 'held', reservedUntil: new Date(NOW - 60_000).toISOString() }, NOW)).toBe(false)
    expect(isReservationActive({ status: 'released' }, NOW)).toBe(false)
  })
})

describe('assessReservation', () => {
  it('reserva quando comprável e sem reserva ativa', () => {
    const decision = assessReservation({ product: product(), activeReservations: [], idempotencyKey: 'k1', now: NOW })
    expect(decision).toEqual({ ok: true, kind: 'reserve', priceCents: 49000, unique: true })
  })

  it('replay idempotente devolve a mesma reserva', () => {
    const decision = assessReservation({
      product: product(),
      activeReservations: [{ status: 'held', reservedUntil: new Date(NOW + 60_000).toISOString(), idempotencyKey: 'k1' }],
      idempotencyKey: 'k1',
      now: NOW,
    })
    expect(decision).toEqual({ ok: true, kind: 'idempotent', idempotencyKey: 'k1' })
  })

  it('peça única já reservada por outro → 409 sold', () => {
    const decision = assessReservation({
      product: product(),
      activeReservations: [{ status: 'held', reservedUntil: new Date(NOW + 60_000).toISOString(), idempotencyKey: 'outro' }],
      idempotencyKey: 'k1',
      now: NOW,
    })
    expect(decision).toEqual({ ok: false, status: 409, code: 'sold', message: expect.any(String) })
  })

  it('reserva expirada de outro não bloqueia', () => {
    const decision = assessReservation({
      product: product(),
      activeReservations: [{ status: 'held', reservedUntil: new Date(NOW - 60_000).toISOString(), idempotencyKey: 'velha' }],
      idempotencyKey: 'k1',
      now: NOW,
    })
    expect(decision.ok).toBe(true)
  })

  it('produto não comprável → 422', () => {
    const decision = assessReservation({
      product: product({ availability: 'made_to_order' }),
      activeReservations: [],
      idempotencyKey: 'k1',
      now: NOW,
    })
    expect(decision).toEqual({ ok: false, status: 422, code: 'not_purchasable', message: expect.any(String) })
  })

  it('peça não única permite múltiplas reservas concorrentes', () => {
    const decision = assessReservation({
      product: product({ edition: null, availability: 'available' }),
      activeReservations: [{ status: 'held', reservedUntil: new Date(NOW + 60_000).toISOString(), idempotencyKey: 'outro' }],
      idempotencyKey: 'k1',
      now: NOW,
    })
    expect(decision.ok).toBe(true)
  })
})
