/* eslint-disable react-hooks/error-boundaries -- Query failures are handled here; render failures remain handled by the Next.js/Payload boundaries. */
import Link from 'next/link'
import type { AdminViewServerProps, Where } from 'payload'

import { Status } from '../../design-system'
import {
  AccessDenied,
  dateTime,
  EmptyState,
  ensureUser,
  findDocs,
  money,
  PageHeader,
  QueryError,
  shortDate,
  TechnicalLink,
  ViewFrame,
} from '../../views/shared'
import {
  CustomerCreateDialog,
  CustomerInterestComposer,
  CustomerMasterList,
  CustomerMergeDialog,
  CustomerNoteComposer,
  CustomerProfileEditor,
} from './CustomerWorkspaceClient'
import {
  activityEventLabels,
  customerOriginLabels,
  customerStatusLabels,
  customerTabLabels,
  hasCustomerRelation,
  relationId,
  relationLabel,
  saleStatusLabels,
  type ActivitySummary,
  type AfterSaleSummary,
  type CategoryRef,
  type ClientInterestSummary,
  type CustomerDetail,
  type CustomerFilters,
  type CustomerListItem,
  type CustomerTab,
  type ProductRef,
  type SaleSummary,
  type TaskSummary,
  type UserRef,
} from './types'
import './customers.scss'

const tabs: CustomerTab[] = ['overview', 'history', 'interests', 'sales', 'after-sales', 'notes']
const purchaseStatuses = new Set(['confirmed', 'production', 'ready', 'delivered'])
const openOpportunityStages = new Set(['new', 'curation', 'proposal', 'negotiation'])

type OpportunitySummary = {
  id: string | number
  stage?: string | null
  estimatedValueCents?: number | null
  nextAction?: string | null
  nextActionAt?: string | null
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

async function paramsOf(props: AdminViewServerProps) {
  return await Promise.resolve(props.searchParams as unknown as Record<string, string | string[] | undefined>)
}

function filtersFrom(params: Record<string, string | string[] | undefined>): CustomerFilters {
  const status = first(params.status)
  return {
    q: (first(params.q) || '').trim().slice(0, 120),
    status: status && ['active', 'follow_up', 'inactive', 'archived'].includes(status) ? status as CustomerFilters['status'] : 'all',
    origin: (first(params.origin) || '').trim(),
    owner: (first(params.owner) || '').trim(),
  }
}

function customerWhere(filters: CustomerFilters, relatedIds: Array<string | number>): Where {
  const and: Where[] = []
  if (filters.status !== 'all') and.push({ status: { equals: filters.status } } as Where)
  if (filters.origin) and.push({ origin: { equals: filters.origin } } as Where)
  if (filters.owner) and.push({ owner: { equals: filters.owner } } as Where)
  if (filters.q) {
    const or: Where[] = [
      { name: { like: filters.q } },
      { company: { like: filters.q } },
      { phone: { like: filters.q } },
      { email: { like: filters.q } },
      { city: { like: filters.q } },
      { 'tags.value': { like: filters.q } },
    ] as Where[]
    if (relatedIds.length) or.push({ id: { in: relatedIds } } as Where)
    and.push({ or } as Where)
  }
  return and.length ? { and } as Where : {}
}

function tabHref(filters: CustomerFilters, customerId: string | number, tab: CustomerTab) {
  const params = new URLSearchParams()
  params.set('customer', String(customerId))
  params.set('tab', tab)
  if (filters.q) params.set('q', filters.q)
  if (filters.status !== 'all') params.set('status', filters.status)
  if (filters.origin) params.set('origin', filters.origin)
  if (filters.owner) params.set('owner', filters.owner)
  return `/admin/customers?${params.toString()}`
}

function relatedCustomerIdsFromSales(sales: Array<{ customer?: unknown }>) {
  return sales.map((sale) => relationId(sale.customer)).filter((id): id is string | number => id !== null)
}

function latestDate(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0]
}

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

export async function CustomersWorkspaceView(props: AdminViewServerProps) {
  const { allowed, role } = ensureUser(props, 'business')
  if (!allowed) return <AccessDenied props={props} area="comercial" />

  const params = await paramsOf(props)
  const filters = filtersFrom(params)
  const selectedId = first(params.customer)
  const requestedTab = first(params.tab) as CustomerTab | undefined
  const tab = requestedTab && tabs.includes(requestedTab) ? requestedTab : 'overview'
  const req = props.initPageResult.req

  try {
    let crossSales: Array<{ customer?: unknown }> = []
    if (filters.q) {
      const [matchingProducts, matchingSales] = await Promise.all([
        findDocs<ProductRef>(req, 'products', {
          depth: 0,
          draft: true,
          limit: 100,
          where: { or: [{ title: { like: filters.q } }, { code: { like: filters.q } }] } as Where,
          select: { id: true },
        }),
        findDocs<{ customer?: unknown }>(req, 'sales', {
          depth: 0,
          limit: 200,
          where: { or: [{ number: { like: filters.q } }, { 'items.snapshotTitle': { like: filters.q } }, { 'items.snapshotSku': { like: filters.q } }] } as Where,
          select: { id: true, customer: true },
        }),
      ])
      crossSales = matchingSales.docs
      if (matchingProducts.docs.length) {
        const byProduct = await findDocs<{ customer?: unknown }>(req, 'sales', {
          depth: 0,
          limit: 500,
          where: { 'items.product': { in: matchingProducts.docs.map((product) => product.id) } } as Where,
          select: { id: true, customer: true },
        })
        crossSales.push(...byProduct.docs)
      }
    }

    const relatedIds = Array.from(new Set(relatedCustomerIdsFromSales(crossSales).map(String)))
    const [customerResult, mergeCandidatesResult, usersResult, categoriesResult, productsResult] = await Promise.all([
      findDocs<Omit<CustomerListItem, 'purchaseCount' | 'lifetimeValueCents'>>(req, 'customers', {
        sort: '-updatedAt',
        limit: 300,
        depth: 1,
        where: customerWhere(filters, relatedIds),
        select: { id: true, name: true, company: true, phone: true, email: true, city: true, state: true, status: true, origin: true, owner: true, createdAt: true, updatedAt: true },
      }),
      findDocs<Omit<CustomerListItem, 'purchaseCount' | 'lifetimeValueCents'>>(req, 'customers', {
        sort: 'name',
        limit: 500,
        depth: 1,
        where: { status: { not_equals: 'archived' } } as Where,
        select: { id: true, name: true, company: true, phone: true, email: true, city: true, state: true, status: true, origin: true, owner: true, createdAt: true, updatedAt: true },
      }),
      findDocs<UserRef>(req, 'users', { sort: 'name', limit: 100, depth: 0, select: { id: true, name: true, email: true } }),
      findDocs<CategoryRef>(req, 'categories', { sort: 'order', limit: 500, depth: 0, draft: true, select: { id: true, title: true, slug: true } }),
      findDocs<ProductRef>(req, 'products', {
        sort: 'title',
        limit: 500,
        depth: 0,
        draft: true,
        where: { catalogStatus: { equals: 'active' } } as Where,
        select: { id: true, title: true, code: true, catalogStatus: true, availability: true },
      }),
    ])

    const visibleIds = customerResult.docs.map((customer) => customer.id)
    const listSales = visibleIds.length ? await findDocs<SaleSummary & { customer?: unknown }>(req, 'sales', {
      sort: '-confirmedAt',
      limit: 1000,
      depth: 0,
      where: { customer: { in: visibleIds } } as Where,
      select: { id: true, customer: true, status: true, totalCents: true, confirmedAt: true, updatedAt: true },
    }) : { docs: [], totalDocs: 0 }

    const listItems: CustomerListItem[] = customerResult.docs.map((customer) => {
      const sales = listSales.docs.filter((sale) => String(relationId(sale.customer)) === String(customer.id) && purchaseStatuses.has(sale.status || ''))
      return {
        ...customer,
        status: customer.status || 'active',
        purchaseCount: sales.length,
        lifetimeValueCents: sales.reduce((sum, sale) => sum + (sale.totalCents || 0), 0),
        lastActivityAt: latestDate([customer.updatedAt, ...sales.map((sale) => sale.confirmedAt || sale.updatedAt)]),
      }
    })

    const mergeCandidates: CustomerListItem[] = mergeCandidatesResult.docs.map((customer) => ({
      ...customer,
      status: customer.status || 'active',
      purchaseCount: 0,
      lifetimeValueCents: 0,
      lastActivityAt: customer.updatedAt,
    }))

    let detail: CustomerDetail | null = null
    let sales: SaleSummary[] = []
    let afterSales: AfterSaleSummary[] = []
    let interests: ClientInterestSummary[] = []
    let opportunities: OpportunitySummary[] = []
    let activities: ActivitySummary[] = []
    let tasks: TaskSummary[] = []

    if (selectedId) {
      detail = await req.payload.findByID({ collection: 'customers', id: selectedId, depth: 2, overrideAccess: false, user: req.user, req }) as unknown as CustomerDetail
      detail.status = detail.status || 'active'
      const [salesResult, afterSalesResult, interestsResult, opportunitiesResult, activitiesResult, tasksResult] = await Promise.all([
        findDocs<SaleSummary>(req, 'sales', { sort: '-confirmedAt', limit: 300, depth: 1, where: { customer: { equals: selectedId } } as Where }),
        findDocs<AfterSaleSummary>(req, 'after-sales', { sort: '-updatedAt', limit: 300, depth: 1, where: { customer: { equals: selectedId } } as Where }),
        findDocs<ClientInterestSummary>(req, 'client-interests', { sort: '-addedAt', limit: 300, depth: 1, where: { customer: { equals: selectedId } } as Where }),
        findDocs<OpportunitySummary>(req, 'opportunities', {
          sort: 'rank',
          limit: 300,
          depth: 0,
          where: { customer: { equals: selectedId } } as Where,
          select: { id: true, stage: true, estimatedValueCents: true, nextAction: true, nextActionAt: true },
        }),
        findDocs<ActivitySummary>(req, 'activities', { sort: '-occurredAt', limit: 1000, depth: 1 }),
        findDocs<TaskSummary>(req, 'tasks', { sort: 'dueAt', limit: 1000, depth: 1 }),
      ])
      sales = salesResult.docs
      afterSales = afterSalesResult.docs
      interests = interestsResult.docs
      opportunities = opportunitiesResult.docs
      activities = activitiesResult.docs.filter((activity) => hasCustomerRelation(activity.relatedTo, selectedId))
      tasks = tasksResult.docs.filter((task) => hasCustomerRelation(task.relatedTo, selectedId))
    }

    const selectedPurchases = sales.filter((sale) => purchaseStatuses.has(sale.status || ''))
    const lifetimeValue = selectedPurchases.reduce((sum, sale) => sum + (sale.totalCents || 0), 0)
    const lastPurchase = selectedPurchases[0]
    const openOpportunities = opportunities.filter((opportunity) => openOpportunityStages.has(opportunity.stage || ''))
    const openOpportunityValue = openOpportunities.reduce((sum, opportunity) => sum + (opportunity.estimatedValueCents || 0), 0)
    const nextTask = tasks.find((task) => task.status === 'pending' || task.status === 'in_progress')
    const noteActivities = activities.filter((activity) => activity.eventType === 'note.created' || activity.kind === 'note')

    return <ViewFrame props={props}>
      <PageHeader
        eyebrow="Relacionamento"
        title="Clientes"
        subtitle="Workspace relacional para entender identidade, interesses, oportunidades, vendas, pós-venda, tarefas e histórico sem abrir múltiplas Collections."
        actions={<><CustomerCreateDialog /><TechnicalLink href="/admin/collections/customers">Admin técnico</TechnicalLink></>}
      />

      <div className={`esmera-customers-workspace${detail ? ' has-detail' : ''}`}>
        <CustomerMasterList customers={listItems} filters={filters} selectedId={selectedId} users={usersResult.docs} />
        {detail ? <section className="esmera-customer-detail">
          <header className="esmera-customer-detail__header">
            <div>
              <Link className="esmera-customer-back" href="/admin/customers">← Clientes</Link>
              <span className="esmera-eyebrow">Cliente</span>
              <h2>{detail.name || 'Cliente sem nome'}</h2>
              <p>{detail.phone || 'Sem telefone'} · {detail.email || 'Sem e-mail'} · cliente desde {shortDate(detail.createdAt)}</p>
              <small>Responsável: {relationLabel(detail.owner, 'não definido')} · origem {customerOriginLabels[detail.origin || ''] || 'não informada'}</small>
            </div>
            <div className="esmera-customer-detail__actions">
              <Status tone={statusTone(detail.status)}>{customerStatusLabels[detail.status] || '—'}</Status>
              {role === 'admin' ? <CustomerMergeDialog source={detail} customers={mergeCandidates} /> : null}
              <TechnicalLink href={`/admin/collections/customers/${detail.id}`}>Admin técnico</TechnicalLink>
            </div>
          </header>

          <nav className="esmera-customer-tabs" aria-label="Seções do cliente">{tabs.map((item) => <Link key={item} className={tab === item ? 'is-active' : ''} aria-current={tab === item ? 'page' : undefined} href={tabHref(filters, detail!.id, item)} scroll={false}>{customerTabLabels[item]}</Link>)}</nav>

          {tab === 'overview' ? <div className="esmera-customer-overview">
            <div className="esmera-customer-summary-grid">
              <article><span>Compras</span><strong>{selectedPurchases.length}</strong><small>{lastPurchase ? `Última em ${shortDate(lastPurchase.confirmedAt || lastPurchase.updatedAt)}` : 'Nenhuma compra confirmada'}</small></article>
              <article><span>Valor histórico</span><strong>{money(lifetimeValue)}</strong><small>Somente vendas confirmadas ou posteriores</small></article>
              <article><span>Interesses ativos</span><strong>{interests.filter((interest) => ['active', 'curation', 'paused'].includes(interest.status || '')).length}</strong><small>Associações explícitas a produtos</small></article>
              <article><span>Oportunidades abertas</span><strong>{openOpportunities.length}</strong><small>{openOpportunities.length ? `${money(openOpportunityValue)} de potencial informado` : 'Nenhuma negociação aberta'}</small></article>
            </div>
            <section className="esmera-customer-next-action"><div><span className="esmera-eyebrow">Próxima ação</span><h3>{nextTask?.title || 'Nenhuma tarefa aberta'}</h3><p>{nextTask ? `${dateTime(nextTask.dueAt)} · ${relationLabel(nextTask.assignee, 'sem responsável')}` : 'Crie uma tarefa real quando houver um próximo passo definido.'}</p></div>{nextTask ? <TechnicalLink href={`/admin/collections/tasks/${nextTask.id}`}>Abrir tarefa</TechnicalLink> : <TechnicalLink href="/admin/collections/tasks/create">Nova tarefa</TechnicalLink>}</section>
            <section className="esmera-customer-profile"><div className="esmera-customer-section-heading"><div><span className="esmera-eyebrow">Perfil</span><h3>Identidade e interesse</h3></div><p>Status do cliente é independente da etapa de qualquer oportunidade comercial.</p></div><CustomerProfileEditor customer={detail} users={usersResult.docs} categories={categoriesResult.docs} /></section>
          </div> : null}

          {tab === 'history' ? <div className="esmera-customer-panel"><div className="esmera-customer-section-heading"><div><span className="esmera-eyebrow">Event stream</span><h3>Histórico relacional</h3></div><p>Activities é append-mostly: operadores criam eventos; somente administradores alteram o passado.</p></div>{!activities.length ? <EmptyState title="Nenhuma atividade registrada" copy="Notas, interesses e mudanças comerciais passam a compor esta timeline." /> : <ol className="esmera-customer-timeline">{activities.map((activity) => <li key={String(activity.id)}><span className="esmera-customer-timeline__marker" aria-hidden="true" /><div><span>{activityLabel(activity)}</span><strong>{activity.summary || activityLabel(activity)}</strong>{activity.details ? <p>{activity.details}</p> : null}<small>{dateTime(activity.occurredAt)} · {relationLabel(activity.owner, 'sistema')}</small></div></li>)}</ol>}</div> : null}

          {tab === 'interests' ? <div className="esmera-customer-panel"><div className="esmera-customer-section-heading"><div><span className="esmera-eyebrow">Curadoria</span><h3>Interesses explícitos</h3></div><p>Relações com produto ficam em ClientInterests para preservar status e histórico por interesse.</p></div><CustomerInterestComposer customerId={detail.id} products={productsResult.docs} interests={interests} /></div> : null}

          {tab === 'sales' ? <div className="esmera-customer-panel"><div className="esmera-customer-section-heading"><div><span className="esmera-eyebrow">Comercial</span><h3>Vendas do cliente</h3></div><p>{sales.length} registro{sales.length === 1 ? '' : 's'} relacionado{sales.length === 1 ? '' : 's'}.</p></div>{!sales.length ? <EmptyState title="Nenhuma venda" copy="As vendas relacionadas aparecerão aqui automaticamente." /> : <div className="esmera-data-table-wrap"><table className="esmera-data-table"><thead><tr><th>Venda</th><th>Status</th><th>Total</th><th>Data</th><th /></tr></thead><tbody>{sales.map((sale) => <tr key={String(sale.id)}><td><strong>{sale.number || sale.id}</strong></td><td><Status tone={statusTone(sale.status)}>{saleStatusLabels[sale.status || ''] || sale.status || '—'}</Status></td><td>{money(sale.totalCents)}</td><td>{shortDate(sale.confirmedAt || sale.updatedAt)}</td><td><Link href={`/admin/sales?view=list&sale=${sale.id}`}>Abrir</Link></td></tr>)}</tbody></table></div>}</div> : null}

          {tab === 'after-sales' ? <div className="esmera-customer-panel"><div className="esmera-customer-section-heading"><div><span className="esmera-eyebrow">Continuidade</span><h3>Pós-venda</h3></div><p>Entrega, follow-ups e ocorrências vinculados ao cliente.</p></div>{!afterSales.length ? <EmptyState title="Nenhum pós-venda" copy="Casos criados a partir de vendas aparecerão aqui automaticamente." /> : <div className="esmera-data-table-wrap"><table className="esmera-data-table"><thead><tr><th>Venda</th><th>Status</th><th>Prioridade</th><th>Entrega</th><th /></tr></thead><tbody>{afterSales.map((item) => <tr key={String(item.id)}><td>{typeof item.sale === 'object' && item.sale ? item.sale.number || item.sale.id : relationId(item.sale) || '—'}</td><td><Status tone={statusTone(item.status)}>{item.status || '—'}</Status></td><td>{item.priority || '—'}</td><td>{shortDate(item.deliveredAt || item.expectedDeliveryAt)}</td><td><Link href={`/admin/collections/after-sales/${item.id}`}>Abrir</Link></td></tr>)}</tbody></table></div>}</div> : null}

          {tab === 'notes' ? <div className="esmera-customer-panel"><div className="esmera-customer-section-heading"><div><span className="esmera-eyebrow">Registro</span><h3>Notas</h3></div><p>Novas notas são eventos imutáveis para o operador e entram na timeline.</p></div><CustomerNoteComposer customerId={detail.id} />{!noteActivities.length ? <EmptyState title="Nenhuma nota" copy="Registre apenas contexto relevante para o relacionamento." /> : <ul className="esmera-customer-notes">{noteActivities.map((activity) => <li key={String(activity.id)}><p>{activity.details || activity.summary}</p><small>{dateTime(activity.occurredAt)} · {relationLabel(activity.owner, 'sistema')}</small></li>)}</ul>}</div> : null}
        </section> : <section className="esmera-customer-detail esmera-customer-detail--empty"><span className="esmera-eyebrow">Detalhe</span><h2>Selecione um cliente</h2><p>Abra uma linha para consultar identidade, interesses, histórico, oportunidades, vendas, pós-venda e notas no mesmo contexto.</p></section>}
      </div>
    </ViewFrame>
  } catch (error) {
    return <ViewFrame props={props}><PageHeader title="Clientes" subtitle="Relacionamento" /><QueryError title="Não foi possível consultar clientes" error={error} /></ViewFrame>
  }
}
