import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { canManageBusiness } from '../../../../access/roles'
import { createLead, deleteLead, qualifyLead } from '../../../../server/domain/leads/operations'

export const dynamic = 'force-dynamic'

type Action = 'create-lead' | 'qualify' | 'delete-lead'

type Body = {
  action?: Action
  id?: string | number
  name?: string
  phone?: string | null
  email?: string | null
  source?: string
  notes?: string | null
}

function message(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message || 'Erro operacional.')
  return 'Não foi possível registrar o lead.'
}

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!canManageBusiness(user)) return NextResponse.json({ error: 'Sem permissão para registrar leads.' }, { status: 403 })

  let body: Body
  try {
    body = await request.json() as Body
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  try {
    if (body.action === 'create-lead') {
      if (!body.name || !body.source) {
        return NextResponse.json({ error: 'Nome e origem são obrigatórios.' }, { status: 400 })
      }
      return NextResponse.json(await createLead(payload, user, {
        name: body.name,
        phone: body.phone,
        email: body.email,
        source: body.source,
        notes: body.notes,
      }))
    }

    if (body.action === 'qualify') {
      if (body.id === undefined) return NextResponse.json({ error: 'O lead é obrigatório.' }, { status: 400 })
      return NextResponse.json(await qualifyLead(payload, user, body.id))
    }

    if (body.action === 'delete-lead') {
      if (body.id === undefined) return NextResponse.json({ error: 'O lead é obrigatório.' }, { status: 400 })
      return NextResponse.json(await deleteLead(payload, user, body.id))
    }

    return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 })
  } catch (error) {
    payload.logger.error({ err: error }, 'admin leads operation failed')
    return NextResponse.json({ error: message(error) }, { status: 422 })
  }
}
