import Link from 'next/link'
import type { PayloadRequest, Where } from 'payload'

import { DataSection, Status } from '../../design-system'
import {
  dateTime,
  EmptyState,
  findDocs,
  money,
  shortDate,
  TechnicalLink,
} from '../../views/shared'
import {
  CustomerInterestComposer,
  CustomerNoteComposer,
  CustomerProfileEditor,
} from './CustomerWorkspaceClient'
import {
  activityEventLabels,
  hasCustomerRelation,
  relationId,
  relationLabel,
  saleStatusLabels,
  type ActivitySummary,
  type AfterSaleSummary,
  type CategoryRef,
  type ClientInterestSummary,
  type CustomerDetail,
  type CustomerTab,
  type ProductRef,
  type SaleSummary,
  type TaskSummary,
  type UserRef,
} from './types'

function statusTone(status?: string | null): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (['active', 'confirmed', 'delivered', 'resolved', 'purchased', 'done'].includes(status || '')) return 'success'
  if (['follow_up', 'proposal', 'negotiation', 'production', 'ready', 'following', 'curation', 'paused', 'pending', 'in_progress'].includes(status || '')) return 'warning'
  if (['cancelled', 'urgent'].includes(status || '')) return 'danger'
  if (status === 'draft') return 'info'
  return 'neutral'
}

function activityLabel(activity: ActivitySummary) {
  return activityEventLabels[activity.eventType || ''] || activity.summary || 'Atividade'
}

function customerRelationWhere(customerId: string | number): Where {
  return {
    and: [
      { 'relatedTo.relationTo': { equals: 'customers' } },
      { 'relatedTo.value': { equals: customerId } },
    ],
  } as Where
}

type Props = {
  req: PayloadRequest
  tab: CustomerTab
  customer: CustomerDetail
  sales: SaleSummary[]
  interests: ClientInterestSummary[]
  products: ProductRef[]
  users: UserRef[]
  categories: CategoryRef[]
}

export async function CustomerDetailTabPanel({
  req,
  tab,
  customer,
  sales,
  interests,
  products,
  users,
  categories,
}: Props) {
  let afterSales: AfterSaleSummary[] = []
  let activities: ActivitySummary[] = []
  let tasks: TaskSummary[] = []

  if (tab === 'after-sales') {
    const result = await findDocs<AfterSaleSummary>(req, 'after-sales', {
      sort: '-updatedAt',
      limit: 300,
      depth: 1,
      where: { customer: { equals: customer.id } } as Where,
      select: {
        id: true,
        status: true,
        priority: true,
        expectedDeliveryAt: true,
        deliveredAt: true,
        incidentType: true,
        updatedAt: true,
        sale: true,
      },
    })
    afterSales = result.docs
  }

  if (tab === 'history' || tab === 'notes') {
    const result = await findDocs<ActivitySummary>(req, 'activities', {
      sort: '-occurredAt',
      limit: 300,
      depth: 1,
      where: customerRelationWhere(customer.id),
      select: {
        id: true,
        eventType: true,
        kind: true,
        summary: true,
        details: true,
        occurredAt: true,
        owner: true,
        relatedTo: true,
      },
    })
    activities = result.docs.filter((activity) => hasCustomerRelation(activity.relatedTo, customer.id))
  }

  if (tab === 'overview') {
    const result = await findDocs<TaskSummary>(req, 'tasks', {
      sort: 'dueAt',
      limit: 100,
      depth: 1,
      where: customerRelationWhere(customer.id),
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueAt: true,
        assignee: true,
        relatedTo: true,
      },
    })
    tasks = result.docs.filter((task) => hasCustomerRelation(task.relatedTo, customer.id))
  }

  const nextTask = tasks.find((task) => task.status === 'pending' || task.status === 'in_progress')
  const noteActivities = activities.filter((activity) => activity.eventType === 'note.created' || activity.kind === 'note')

  if (tab === 'overview') {
    return (
      <div className="esmera-customer-overview">
        <DataSection
          compact
          eyebrow="Próxima ação"
          title={nextTask?.title || 'Nenhuma tarefa aberta'}
          description={nextTask ? `${dateTime(nextTask.dueAt)} · ${relationLabel(nextTask.assignee, 'sem responsável')}` : 'Crie uma tarefa real quando houver um próximo passo definido.'}
          action={nextTask ? <TechnicalLink href={`/admin/collections/tasks/${nextTask.id}`}>Abrir tarefa</TechnicalLink> : <TechnicalLink href="/admin/collections/tasks/create">Nova tarefa</TechnicalLink>}
        ><div /></DataSection>
        <DataSection eyebrow="Perfil" title="Identidade e interesse" description="Status do cliente é independente da etapa de qualquer oportunidade comercial.">
          <CustomerProfileEditor customer={customer} users={users} categories={categories} />
        </DataSection>
      </div>
    )
  }

  if (tab === 'history') {
    return (
      <DataSection eyebrow="Event stream" title="Histórico relacional" description="Activities é append-mostly: operadores criam eventos; somente administradores alteram o passado.">
        {!activities.length ? <EmptyState title="Nenhuma atividade registrada" copy="Notas, interesses e mudanças comerciais passam a compor esta timeline." /> : (
          <ol className="esmera-customer-timeline">
            {activities.map((activity) => (
              <li key={String(activity.id)}>
                <span className="esmera-customer-timeline__marker" aria-hidden="true" />
                <div>
                  <span>{activityLabel(activity)}</span>
                  <strong>{activity.summary || activityLabel(activity)}</strong>
                  {activity.details ? <p>{activity.details}</p> : null}
                  <small>{dateTime(activity.occurredAt)} · {relationLabel(activity.owner, 'sistema')}</small>
                </div>
              </li>
            ))}
          </ol>
        )}
      </DataSection>
    )
  }

  if (tab === 'interests') {
    return (
      <DataSection eyebrow="Curadoria" title="Interesses explícitos" description="Relações com produto ficam em ClientInterests para preservar status e histórico por interesse.">
        <CustomerInterestComposer customerId={customer.id} products={products} interests={interests} />
      </DataSection>
    )
  }

  if (tab === 'sales') {
    return (
      <DataSection eyebrow="Comercial" title="Vendas do cliente" description={`${sales.length} registro${sales.length === 1 ? '' : 's'} relacionado${sales.length === 1 ? '' : 's'}.`}>
        {!sales.length ? <EmptyState title="Nenhuma venda" copy="As vendas relacionadas aparecerão aqui automaticamente." /> : (
          <div className="esmera-data-table-wrap">
            <table className="esmera-data-table">
              <thead><tr><th>Venda</th><th>Status</th><th>Total</th><th>Data</th><th /></tr></thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={String(sale.id)}>
                    <td><strong>{sale.number || sale.id}</strong></td>
                    <td><Status tone={statusTone(sale.status)}>{saleStatusLabels[sale.status || ''] || sale.status || '—'}</Status></td>
                    <td>{money(sale.totalCents)}</td>
                    <td>{shortDate(sale.confirmedAt || sale.updatedAt)}</td>
                    <td><Link href={`/admin/sales?q=${encodeURIComponent(sale.number || String(sale.id))}`}>Abrir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataSection>
    )
  }

  if (tab === 'after-sales') {
    return (
      <DataSection eyebrow="Continuidade" title="Pós-venda" description="Entrega, follow-ups e ocorrências vinculados ao cliente.">
        {!afterSales.length ? <EmptyState title="Nenhum pós-venda" copy="Casos criados a partir de vendas aparecerão aqui automaticamente." /> : (
          <div className="esmera-data-table-wrap">
            <table className="esmera-data-table">
              <thead><tr><th>Venda</th><th>Status</th><th>Prioridade</th><th>Entrega</th><th /></tr></thead>
              <tbody>
                {afterSales.map((item) => (
                  <tr key={String(item.id)}>
                    <td>{typeof item.sale === 'object' && item.sale ? item.sale.number || item.sale.id : relationId(item.sale) || '—'}</td>
                    <td><Status tone={statusTone(item.status)}>{item.status || '—'}</Status></td>
                    <td>{item.priority || '—'}</td>
                    <td>{shortDate(item.deliveredAt || item.expectedDeliveryAt)}</td>
                    <td><Link href={`/admin/after-sales?case=${item.id}`}>Abrir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataSection>
    )
  }

  return (
    <DataSection eyebrow="Registro" title="Notas" description="Novas notas são eventos imutáveis para o operador e entram na timeline.">
      <CustomerNoteComposer customerId={customer.id} />
      {!noteActivities.length ? <EmptyState title="Nenhuma nota" copy="Registre apenas contexto relevante para o relacionamento." /> : (
        <ul className="esmera-customer-notes">
          {noteActivities.map((activity) => (
            <li key={String(activity.id)}>
              <p>{activity.details || activity.summary}</p>
              <small>{dateTime(activity.occurredAt)} · {relationLabel(activity.owner, 'sistema')}</small>
            </li>
          ))}
        </ul>
      )}
    </DataSection>
  )
}
