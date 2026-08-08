/**
 * Núcleo puro do fluxo transacional de COMPRAR (plano §16).
 *
 * Nenhuma dependência de Payload/DB: só a decisão. O backend é a fonte de
 * verdade no momento da compra — a disponibilidade é reavaliada aqui, nunca
 * confiando no estado carregado junto com a página.
 */
export type ReservationStatus = 'held' | 'confirmed' | 'released' | 'expired'

export type ReservableProduct = {
  id: string | number
  slug: string
  catalogStatus?: string | null
  status?: string | null
  availability?: string | null
  priceMode?: string | null
  basePriceCents?: number | null
  isUnique?: boolean | null
  edition?: string | null
}

export type ActiveReservationSnapshot = {
  status?: ReservationStatus | string | null
  reservedUntil?: string | null
  idempotencyKey?: string | null
}

export type ReservationDecision =
  | { ok: true; kind: 'idempotent'; idempotencyKey: string }
  | { ok: true; kind: 'reserve'; priceCents: number; unique: boolean }
  | { ok: false; status: 409 | 422; code: 'sold' | 'not_purchasable' | 'unavailable'; message: string }

export const HELD_TTL_MS = 15 * 60 * 1000

function fold(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
}

export function isUniquePiece(product: ReservableProduct): boolean {
  return Boolean(product.isUnique) ||
    product.availability === 'unique' ||
    fold(product.edition) === 'peca unica'
}

/** Uma reserva “segura o lugar” enquanto está confirmada ou dentro do TTL. */
export function isReservationActive(
  reservation: ActiveReservationSnapshot,
  now: number,
): boolean {
  if (reservation.status === 'confirmed') return true
  if (reservation.status !== 'held') return false
  if (!reservation.reservedUntil) return false
  const until = new Date(reservation.reservedUntil).getTime()
  return Number.isFinite(until) && until > now
}

export function isProductPurchasable(product: ReservableProduct): boolean {
  const catalogActive = product.catalogStatus === 'active'
  const published = product.status == null || product.status === 'published'
  const fixedPriced = product.priceMode === 'fixed' &&
    typeof product.basePriceCents === 'number' && product.basePriceCents > 0
  const availability = product.availability ?? ''
  // made_to_order/sob consulta seguem por consulta, não por compra direta.
  // `unique` legado é comprável (é peça disponível única).
  const buyableState = availability === 'available' || availability === 'limited' ||
    availability === 'unique'
  return catalogActive && published && fixedPriced && buyableState
}

export function assessReservation(input: {
  product: ReservableProduct
  activeReservations: ActiveReservationSnapshot[]
  idempotencyKey: string
  now: number
}): ReservationDecision {
  const { product, activeReservations, idempotencyKey, now } = input

  // Replay idempotente: mesma chave já reservou → devolve a mesma reserva.
  if (activeReservations.some((reservation) => reservation.idempotencyKey === idempotencyKey)) {
    return { ok: true, kind: 'idempotent', idempotencyKey }
  }

  if (!isProductPurchasable(product)) {
    return { ok: false, status: 422, code: 'not_purchasable', message: 'Esta peça não está disponível para compra direta.' }
  }

  const unique = isUniquePiece(product)
  if (unique) {
    const heldByOther = activeReservations.some((reservation) => isReservationActive(reservation, now))
    if (heldByOther) {
      return { ok: false, status: 409, code: 'sold', message: 'Esta peça única acabou de ser reservada.' }
    }
  }

  return { ok: true, kind: 'reserve', priceCents: product.basePriceCents as number, unique }
}
