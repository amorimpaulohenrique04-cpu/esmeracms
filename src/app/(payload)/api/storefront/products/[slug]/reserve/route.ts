import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { withSerializableTransaction } from '../../../../../../../server/publication/concurrency'
import {
  assessReservation,
  HELD_TTL_MS,
  type ActiveReservationSnapshot,
  type ReservableProduct,
} from '../../../../../../../server/domain/reservations/reserve'

export const dynamic = 'force-dynamic'

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,120}$/

type UnknownRecord = Record<string, unknown>

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function reservationView(doc: UnknownRecord) {
  return {
    id: String(doc.id),
    status: doc.status,
    productSlug: doc.productSlug,
    reservedUntil: doc.reservedUntil ?? null,
    priceCents: typeof doc.priceCents === 'number' ? doc.priceCents : null,
    idempotencyKey: doc.idempotencyKey,
  }
}

/**
 * POST /api/storefront/products/:slug/reserve
 *
 * Reserva transacional (plano §16): reavalia a disponibilidade no servidor,
 * reserva atomicamente e é idempotente por `idempotencyKey`. Só uma reserva de
 * peça única vence — as demais recebem 409 `sold`.
 */
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const payload = await getPayload({ config })
  const { slug } = await context.params
  if (!/^[a-z0-9-]+$/.test(slug)) return jsonError(400, 'invalid_request', 'Slug de produto inválido.')

  let body: UnknownRecord
  try {
    body = (await request.json()) as UnknownRecord
  } catch {
    return jsonError(400, 'invalid_request', 'Corpo da requisição inválido.')
  }
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : ''
  if (!KEY_PATTERN.test(idempotencyKey)) {
    return jsonError(400, 'invalid_request', 'idempotencyKey ausente ou inválida (8–120 caracteres).')
  }
  const variantSku = typeof body.variantSku === 'string' ? body.variantSku.trim().slice(0, 80) || null : null
  const buyerRef = typeof body.buyerRef === 'string' ? body.buyerRef.trim().slice(0, 160) || null : null

  try {
    const productResult = await payload.find({
      collection: 'products',
      depth: 0,
      draft: false,
      limit: 1,
      pagination: false,
      overrideAccess: true,
      where: {
        and: [
          { slug: { equals: slug } },
          { catalogStatus: { equals: 'active' } },
          { _status: { equals: 'published' } },
        ],
      },
      select: {
        id: true,
        slug: true,
        catalogStatus: true,
        availability: true,
        priceMode: true,
        basePriceCents: true,
        edition: true,
      },
    })
    const doc = (productResult.docs as unknown as UnknownRecord[])[0]
    if (!doc) return jsonError(404, 'product_not_found', 'Produto não encontrado.')

    const product: ReservableProduct = {
      id: doc.id as number,
      slug: String(doc.slug),
      catalogStatus: (doc.catalogStatus as string) ?? null,
      status: 'published',
      availability: (doc.availability as string) ?? null,
      priceMode: (doc.priceMode as string) ?? null,
      basePriceCents: typeof doc.basePriceCents === 'number' ? doc.basePriceCents : null,
      edition: (doc.edition as string) ?? null,
    }

    const now = Date.now()

    // Transação serializável: leitura das reservas ativas + criação no mesmo
    // ponto de consistência. O commit pode ser engolido numa corrida, então
    // relemos DEPOIS para decidir quem venceu (ver concurrency.ts).
    const outcome = await withSerializableTransaction(payload, null, async (req) => {
      const existing = await payload.find({
        collection: 'reservations',
        depth: 0,
        limit: 100,
        pagination: false,
        overrideAccess: true,
        req,
        where: {
          and: [
            { productId: { equals: product.id } },
            { status: { in: ['held', 'confirmed'] } },
          ],
        },
        select: { status: true, reservedUntil: true, idempotencyKey: true },
      })
      const active: ActiveReservationSnapshot[] = (existing.docs as unknown as UnknownRecord[]).map((row) => ({
        status: row.status as ActiveReservationSnapshot['status'],
        reservedUntil: (row.reservedUntil as string) ?? null,
        idempotencyKey: (row.idempotencyKey as string) ?? null,
      }))

      const decision = assessReservation({ product, activeReservations: active, idempotencyKey, now })
      if (!decision.ok || decision.kind === 'idempotent') return { decision }

      await payload.create({
        collection: 'reservations',
        overrideAccess: true,
        req,
        data: {
          productId: Number(product.id),
          productSlug: product.slug,
          variantSku,
          uniquePiece: decision.unique,
          status: 'held',
          idempotencyKey,
          reservedUntil: new Date(now + HELD_TTL_MS).toISOString(),
          priceCents: decision.priceCents,
          buyerRef,
        },
      })
      return { decision }
    })

    if (!outcome.decision.ok) {
      return jsonError(outcome.decision.status, outcome.decision.code, outcome.decision.message)
    }

    // Releitura pós-commit: para peça única, o vencedor é a reserva ativa mais
    // antiga. Se não formos nós, liberamos a nossa e devolvemos 409.
    const confirmation = await payload.find({
      collection: 'reservations',
      depth: 0,
      limit: 100,
      pagination: false,
      overrideAccess: true,
      sort: ['createdAt', 'id'],
      where: {
        and: [
          { productId: { equals: product.id } },
          { status: { in: ['held', 'confirmed'] } },
        ],
      },
      select: { status: true, idempotencyKey: true, reservedUntil: true, productSlug: true, priceCents: true },
    })
    const rows = confirmation.docs as unknown as UnknownRecord[]
    const ours = rows.find((row) => row.idempotencyKey === idempotencyKey)
    if (!ours) return jsonError(409, 'sold', 'Esta peça acabou de ser reservada.')

    const uniqueDecision = outcome.decision.kind === 'reserve' && outcome.decision.unique
    if (uniqueDecision) {
      const winner = rows[0]
      if (winner && winner.idempotencyKey !== idempotencyKey) {
        await payload.update({
          collection: 'reservations',
          id: ours.id as string | number,
          overrideAccess: true,
          data: { status: 'released' },
        }).catch(() => undefined)
        return jsonError(409, 'sold', 'Esta peça única acabou de ser reservada.')
      }
    }

    const status = outcome.decision.kind === 'idempotent' ? 200 : 201
    return NextResponse.json({ reservation: reservationView(ours) }, {
      status,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    // Violação do índice único (idempotencyKey ou índice parcial de peça única)
    // numa corrida: relê para distinguir replay de peça vendida.
    payload.logger.error({
      event: 'storefront.reserve.failed',
      slug,
      error: error instanceof Error ? error.message : 'unknown_error',
    })
    const replay = await payload.find({
      collection: 'reservations',
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
      where: { idempotencyKey: { equals: idempotencyKey } },
      select: { status: true, idempotencyKey: true, reservedUntil: true, productSlug: true, priceCents: true },
    }).catch(() => ({ docs: [] as UnknownRecord[] }))
    const existing = (replay.docs as unknown as UnknownRecord[])[0]
    if (existing) {
      return NextResponse.json({ reservation: reservationView(existing) }, {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      })
    }
    return jsonError(500, 'reserve_failed', 'Não foi possível reservar esta peça agora.')
  }
}
