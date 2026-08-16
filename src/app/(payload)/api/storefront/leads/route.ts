import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/

type UnknownRecord = Record<string, unknown>

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

/**
 * POST /api/storefront/leads
 *
 * Captura pública de lead (ex: WhatsApp do rodapé do storefront). Cria
 * diretamente em `leads` com `source: 'site'` — sem transação/idempotência
 * porque não há concorrência de estoque envolvida, ao contrário da reserva.
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

  try {
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
  } catch (error) {
    payload.logger.error({
      event: 'storefront.leads.failed',
      error: error instanceof Error ? error.message : 'unknown_error',
    })
    return jsonError(500, 'lead_failed', 'Não foi possível registrar o contato agora.')
  }
}
