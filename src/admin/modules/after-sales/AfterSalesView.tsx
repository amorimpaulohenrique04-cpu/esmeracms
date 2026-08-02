/* eslint-disable react-hooks/error-boundaries -- Query failures are handled here; render failures remain handled by the Next.js/Payload boundaries. */
import type { AdminViewServerProps } from 'payload'

import {
  AccessDenied,
  ensureUser,
  findDocs,
  PageHeader,
  QueryError,
  TechnicalLink,
  ViewFrame,
} from '../../views/shared'
import { AfterSalesHydratedWorkspace } from './AfterSalesHydratedWorkspace'
import type {
  ActivityRecord,
  AfterSalesCase,
  AfterSalesFilters,
  OccurrenceRecord,
  QueueFocus,
  ShipmentRecord,
  TaskRecord,
  UserRef,
} from './types'
import './after-sales.scss'

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

async function paramsOf(props: AdminViewServerProps) {
  return await Promise.resolve(props.searchParams as unknown as Record<string, string | string[] | undefined>)
}

function filtersFrom(params: Record<string, string | string[] | undefined>): AfterSalesFilters {
  const focusValue = first(params.focus)
  const focus: QueueFocus = focusValue && ['all', 'today', 'overdue', 'occurrences', 'deliveries'].includes(focusValue)
    ? focusValue as QueueFocus
    : 'all'
  return {
    focus,
    q: (first(params.q) || '').trim().slice(0, 120),
    owner: (first(params.owner) || '').trim(),
    priority: (first(params.priority) || '').trim(),
    type: (first(params.type) || '').trim(),
    status: (first(params.status) || 'open').trim(),
  }
}

export async function AfterSalesView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'business')
  if (!allowed) return <AccessDenied props={props} area="comercial" />

  const req = props.initPageResult.req
  const filters = filtersFrom(await paramsOf(props))

  try {
    const [caseResult, taskResult, shipmentResult, occurrenceResult, activityResult, usersResult] = await Promise.all([
      findDocs<AfterSalesCase>(req, 'after-sales', {
        sort: '-updatedAt',
        limit: 500,
        depth: 2,
        select: {
          id: true,
          caseNumber: true,
          sale: true,
          customer: true,
          status: true,
          priority: true,
          owner: true,
          summary: true,
          openedAt: true,
          closedAt: true,
          updatedAt: true,
        },
      }),
      findDocs<TaskRecord>(req, 'tasks', {
        sort: 'dueAt',
        limit: 1000,
        depth: 2,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          priority: true,
          dueAt: true,
          assignee: true,
          relatedTo: true,
          notes: true,
          completedAt: true,
          updatedAt: true,
        },
      }),
      findDocs<ShipmentRecord>(req, 'shipments', {
        sort: '-updatedAt',
        limit: 500,
        depth: 2,
        select: {
          id: true,
          afterSalesCase: true,
          sale: true,
          customer: true,
          carrier: true,
          trackingCode: true,
          status: true,
          estimatedDelivery: true,
          deliveredAt: true,
          lastEvent: true,
          notes: true,
          updatedAt: true,
        },
      }),
      findDocs<OccurrenceRecord>(req, 'occurrences', {
        sort: '-openedAt',
        limit: 500,
        depth: 2,
        select: {
          id: true,
          afterSalesCase: true,
          sale: true,
          customer: true,
          type: true,
          severity: true,
          status: true,
          owner: true,
          description: true,
          resolution: true,
          openedAt: true,
          closedAt: true,
          updatedAt: true,
        },
      }),
      findDocs<ActivityRecord>(req, 'activities', {
        sort: '-occurredAt',
        limit: 1000,
        depth: 1,
        select: {
          id: true,
          eventType: true,
          kind: true,
          occurredAt: true,
          summary: true,
          details: true,
          owner: true,
          relatedTo: true,
        },
      }),
      findDocs<UserRef>(req, 'users', {
        sort: 'name',
        limit: 100,
        depth: 0,
        select: { id: true, name: true, email: true },
      }),
    ])

    return <ViewFrame props={props}>
      <PageHeader
        eyebrow="Operações"
        title="Pós-venda"
        subtitle="Fila operacional de tarefas, entregas e ocorrências. Prazos e estados reais substituem percentuais artificiais."
        actions={<><TechnicalLink href="/admin/collections/after-sales/create" primary>Novo caso</TechnicalLink><TechnicalLink href="/admin/collections/tasks">Tarefas técnicas</TechnicalLink></>}
      />
      <AfterSalesHydratedWorkspace
        cases={caseResult.docs}
        tasks={taskResult.docs}
        shipments={shipmentResult.docs}
        occurrences={occurrenceResult.docs}
        activities={activityResult.docs}
        users={usersResult.docs}
        filters={filters}
      />
    </ViewFrame>
  } catch (error) {
    return <ViewFrame props={props}><PageHeader title="Pós-venda" subtitle="Operações" /><QueryError title="Não foi possível consultar o pós-venda" error={error} /></ViewFrame>
  }
}
