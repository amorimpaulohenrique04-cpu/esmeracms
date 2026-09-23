import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/
const PRODUCT_ACTIONS = new Set(['add', 'remove'])

type UnknownRecord = Record<string, unknown>

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function relationshipIDs(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item === 'number' && Number.isInteger(item)) return [item]
    if (
      item &&
      typeof item === 'object' &&
      'id' in item &&
      typeof item.id === 'number' &&
      Number.isInteger(item.id)
    ) {
      return [item.id]
    }
    return []
  })
}

/**
 * POST /api/storefront/leads
 *
 * Captura pública de leads do storefront.
 * - Formulário do rodapé continua aceitando apenas `phone`.
 * - Favoritos enviam `name`, `phone`, `productId` e `action`.
 *   Nesse fluxo fazemos upsert por telefone e sincronizamos `interestedProducts`.
 */
export async function POST(request: Request) {
  const payload = await getPayload({ config })

  let body: UnknownRecord
  try {
    body = (await request.json()) as UnknownRecord
  } catch {
    return jsonError(400, 'invalid_request', 'Corpo da requisição inválido.')
  }

  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  if (!PHONE_PATTERN.test(phone)) {
    return jsonError(400, 'invalid_request', 'Telefone inválido. Use o formato E.164, como +5511999990000.')
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : ''
  const rawProductId = typeof body.productId === 'string' || typeof body.productId === 'number'
    ? Number(body.productId)
    : Number.NaN
  const productId = Number.isInteger(rawProductId) && rawProductId > 0
    ? rawProductId
    : null
  const action = typeof body.action === 'string' ? body.action : 'add'
  const isFavoriteRequest = productId !== null

  if (isFavoriteRequest && name.length < 2) {
    return jsonError(400, 'invalid_request', 'Informe seu nome para salvar favoritos.')
  }
  if (isFavoriteRequest && !PRODUCT_ACTIONS.has(action)) {
    return jsonError(400, 'invalid_request', 'Ação de favorito inválida.')
  }

  try {
    if (!isFavoriteRequest) {
      const lead = await payload.create({
        collection: 'leads',
        overrideAccess: true,
        data: {
          name: `Lead do rodapé — ${phone}`,
          phone,
          source: 'site',
        },
      })
      return NextResponse.json({ lead: { id: String(lead.id) } }, {
        status: 201,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    const existing = await payload.find({
      collection: 'leads',
      overrideAccess: true,
      limit: 1,
      depth: 0,
      where: {
        phone: { equals: phone },
      },
    })

    const lead = existing.docs[0]
    if (!lead && action === 'remove') {
      return NextResponse.json({ lead: null, favoritesUpdated: false }, {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    if (!lead) {
      const created = await payload.create({
        collection: 'leads',
        overrideAccess: true,
        data: {
          name,
          phone,
          source: 'site',
          interestedProducts: [productId],
        },
      })
      return NextResponse.json({
        lead: { id: String(created.id) },
        favoritesUpdated: true,
      }, {
        status: 201,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    const currentProducts = relationshipIDs(lead.interestedProducts)
    const nextProducts = action === 'remove'
      ? currentProducts.filter((id) => id !== productId)
      : currentProducts.includes(productId)
        ? currentProducts
        : [...currentProducts, productId]

    const updated = await payload.update({
      collection: 'leads',
      id: lead.id,
      overrideAccess: true,
      data: {
        name,
        phone,
        interestedProducts: nextProducts,
      },
    })

    return NextResponse.json({
      lead: { id: String(updated.id) },
      favoritesUpdated: true,
    }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    payload.logger.error({
      event: 'storefront.leads.failed',
      error: error instanceof Error ? error.message : 'unknown_error',
      favoriteAction: isFavoriteRequest ? action : null,
    })
    return jsonError(500, 'lead_failed', 'Não foi possível registrar o contato agora.')
  }
}
