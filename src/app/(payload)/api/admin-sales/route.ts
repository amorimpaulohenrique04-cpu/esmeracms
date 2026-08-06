import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { canManageBusiness } from '../../../../access/roles'
import {
  isOpportunityLossReason,
  isOpportunityStage,
  type OpportunityStage,
} from '../../../../businessRules/opportunities/stages'
import {
  bulkMoveOpportunities,
  createSale,
  loseOpportunity,
  moveOpportunity,
  reorderOpportunityStage,
  winOpportunity,
  type SaleWorkflowItem,
} from '../../../../server/domain/sales/opportunityWorkflow'

export const dynamic = 'force-dynamic'

type SalesAction = 'move-stage' | 'reorder-stage' | 'bulk-stage' | 'create' | 'win' | 'lose'

type RequestBody = {
  action?: SalesAction
  id?: string | number
  ids?: Array<string | number>
  stage?: string
  sourceStage?: string | null
  targetOrderedIds?: Array<string | number>
  sourceOrderedIds?: Array<string | number>
  lossReason?: string
  lossNotes?: string | null
  channel?: string
  customerID?: string | number
  items?: SaleWorkflowItem[]
  discountCents?: number
  shippingCents?: number
  expectedDeliveryAt?: string | null
  deliveryMode?: string | null
  deliveryNotes?: string | null
}

const channels = new Set(['whatsapp', 'instagram', 'site', 'referral', 'architect', 'other'])
const deliveryModes = new Set(['carrier', 'pickup', 'own_delivery'])

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || 'Erro de validação.')
  }
  return 'Não foi possível atualizar a operação comercial.'
}

function cents(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0
}

function stage(value: unknown): OpportunityStage | null {
  return isOpportunityStage(value) ? value : null
}

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!canManageBusiness(user)) return NextResponse.json({ error: 'Sem permissão para operar Vendas.' }, { status: 403 })

  let body: RequestBody
  try {
    body = await request.json() as RequestBody
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  try {
    if (body.action === 'move-stage') {
      const toStage = stage(body.stage)
      const sourceStage = body.sourceStage ? stage(body.sourceStage) : null
      if (body.id === undefined || !toStage || !Array.isArray(body.targetOrderedIds)) {
        return NextResponse.json({ error: 'Oportunidade, etapa e ordem de destino são obrigatórias.' }, { status: 400 })
      }
      const result = await moveOpportunity(payload, user, {
        id: body.id,
        toStage,
        targetOrderedIds: body.targetOrderedIds,
        sourceStage,
        sourceOrderedIds: Array.isArray(body.sourceOrderedIds) ? body.sourceOrderedIds : undefined,
      })
      return NextResponse.json(result)
    }

    if (body.action === 'reorder-stage') {
      const targetStage = stage(body.stage)
      if (!targetStage || !Array.isArray(body.targetOrderedIds)) {
        return NextResponse.json({ error: 'Etapa e ordem são obrigatórias.' }, { status: 400 })
      }
      return NextResponse.json(await reorderOpportunityStage(payload, user, targetStage, body.targetOrderedIds))
    }

    if (body.action === 'bulk-stage') {
      const targetStage = stage(body.stage)
      if (!targetStage || !Array.isArray(body.ids) || !body.ids.length) {
        return NextResponse.json({ error: 'Selecione oportunidades e uma etapa de destino.' }, { status: 400 })
      }
      return NextResponse.json(await bulkMoveOpportunities(payload, user, body.ids, targetStage))
    }

    if (body.action === 'create') {
      if (body.customerID === undefined || body.customerID === null || !Array.isArray(body.items)) {
        return NextResponse.json({ error: 'Cliente e itens são obrigatórios.' }, { status: 400 })
      }
      return NextResponse.json(await createSale(payload, user, {
        customerID: body.customerID,
        items: body.items,
      }))
    }

    if (body.action === 'lose') {
      if (body.id === undefined || !isOpportunityLossReason(body.lossReason)) {
        return NextResponse.json({ error: 'Oportunidade e motivo de perda são obrigatórios.' }, { status: 400 })
      }
      return NextResponse.json(await loseOpportunity(payload, user, {
        id: body.id,
        lossReason: body.lossReason,
        lossNotes: body.lossNotes,
      }))
    }

    if (body.action === 'win') {
      if (body.id === undefined || !channels.has(String(body.channel)) || !Array.isArray(body.items)) {
        return NextResponse.json({ error: 'Oportunidade, canal e itens são obrigatórios.' }, { status: 400 })
      }
      const deliveryMode = body.deliveryMode && deliveryModes.has(body.deliveryMode)
        ? body.deliveryMode as 'carrier' | 'pickup' | 'own_delivery'
        : null
      return NextResponse.json(await winOpportunity(payload, user, {
        id: body.id,
        channel: body.channel as 'whatsapp' | 'instagram' | 'site' | 'referral' | 'architect' | 'other',
        items: body.items,
        discountCents: cents(body.discountCents),
        shippingCents: cents(body.shippingCents),
        expectedDeliveryAt: body.expectedDeliveryAt || null,
        deliveryMode,
        deliveryNotes: body.deliveryNotes,
      }))
    }

    return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 })
  } catch (error) {
    payload.logger.error({ err: error }, 'admin sales operation failed')
    return NextResponse.json({ error: errorMessage(error) }, { status: 422 })
  }
}
