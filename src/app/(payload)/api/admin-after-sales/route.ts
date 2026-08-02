import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { canManageBusiness } from '../../../../access/roles'
import {
  isAfterSalesStatus,
  isOccurrenceSeverity,
  isOccurrenceStatus,
  isOccurrenceType,
  isShipmentStatus,
  isTaskStatus,
  isTaskType,
  operationalPriorities,
  type OperationalPriority,
} from '../../../../businessRules/afterSales/model'
import {
  createAfterSalesOccurrence,
  createAfterSalesShipment,
  createAfterSalesTask,
  resolveAfterSalesOccurrence,
  updateAfterSalesCase,
  updateAfterSalesShipment,
  updateAfterSalesTaskStatus,
} from '../../../../server/domain/afterSales/operations'

export const dynamic = 'force-dynamic'

type Action =
  | 'create-task'
  | 'update-task-status'
  | 'create-shipment'
  | 'update-shipment'
  | 'create-occurrence'
  | 'resolve-occurrence'
  | 'update-case'

type Body = {
  action?: Action
  id?: string | number
  caseId?: string | number
  title?: string
  type?: string
  dueAt?: string
  priority?: string
  assignee?: string | number | null
  notes?: string | null
  status?: string
  carrier?: string | null
  trackingCode?: string | null
  estimatedDelivery?: string | null
  lastEvent?: string | null
  severity?: string
  owner?: string | number | null
  description?: string
  resolution?: string
}

function message(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message || 'Erro operacional.')
  return 'Não foi possível atualizar o pós-venda.'
}

function priority(value: unknown): OperationalPriority | null {
  return typeof value === 'string' && operationalPriorities.includes(value as OperationalPriority)
    ? value as OperationalPriority
    : null
}

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!canManageBusiness(user)) return NextResponse.json({ error: 'Sem permissão para operar o pós-venda.' }, { status: 403 })

  let body: Body
  try {
    body = await request.json() as Body
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  try {
    if (body.action === 'create-task') {
      const taskPriority = priority(body.priority)
      if (body.caseId === undefined || !body.title || !body.dueAt || !isTaskType(body.type) || !taskPriority) {
        return NextResponse.json({ error: 'Caso, objetivo, tipo, prazo e prioridade são obrigatórios.' }, { status: 400 })
      }
      return NextResponse.json(await createAfterSalesTask(payload, user, {
        caseId: body.caseId,
        title: body.title,
        type: body.type,
        dueAt: body.dueAt,
        priority: taskPriority,
        assignee: body.assignee,
        notes: body.notes,
      }))
    }

    if (body.action === 'update-task-status') {
      if (body.id === undefined || !isTaskStatus(body.status)) {
        return NextResponse.json({ error: 'Tarefa e status são obrigatórios.' }, { status: 400 })
      }
      return NextResponse.json(await updateAfterSalesTaskStatus(payload, user, body.id, body.status))
    }

    if (body.action === 'create-shipment') {
      if (body.caseId === undefined || !isShipmentStatus(body.status)) {
        return NextResponse.json({ error: 'Caso e status de entrega são obrigatórios.' }, { status: 400 })
      }
      return NextResponse.json(await createAfterSalesShipment(payload, user, {
        caseId: body.caseId,
        carrier: body.carrier,
        trackingCode: body.trackingCode,
        status: body.status,
        estimatedDelivery: body.estimatedDelivery,
        lastEvent: body.lastEvent,
        notes: body.notes,
      }))
    }

    if (body.action === 'update-shipment') {
      if (body.id === undefined || !isShipmentStatus(body.status)) {
        return NextResponse.json({ error: 'Entrega e status são obrigatórios.' }, { status: 400 })
      }
      return NextResponse.json(await updateAfterSalesShipment(payload, user, body.id, body.status, body.lastEvent))
    }

    if (body.action === 'create-occurrence') {
      if (body.caseId === undefined || !isOccurrenceType(body.type) || !isOccurrenceSeverity(body.severity) || !body.description) {
        return NextResponse.json({ error: 'Caso, tipo, severidade e descrição são obrigatórios.' }, { status: 400 })
      }
      return NextResponse.json(await createAfterSalesOccurrence(payload, user, {
        caseId: body.caseId,
        type: body.type,
        severity: body.severity,
        owner: body.owner,
        description: body.description,
      }))
    }

    if (body.action === 'resolve-occurrence') {
      if (body.id === undefined || !isOccurrenceStatus(body.status) || !body.resolution) {
        return NextResponse.json({ error: 'Ocorrência, status e resolução são obrigatórios.' }, { status: 400 })
      }
      return NextResponse.json(await resolveAfterSalesOccurrence(payload, user, body.id, body.status, body.resolution))
    }

    if (body.action === 'update-case') {
      if (body.id === undefined || !isAfterSalesStatus(body.status)) {
        return NextResponse.json({ error: 'Caso e status são obrigatórios.' }, { status: 400 })
      }
      return NextResponse.json(await updateAfterSalesCase(payload, user, body.id, body.status, priority(body.priority) || undefined))
    }

    return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 })
  } catch (error) {
    payload.logger.error({ err: error }, 'admin after-sales operation failed')
    return NextResponse.json({ error: message(error) }, { status: 422 })
  }
}
