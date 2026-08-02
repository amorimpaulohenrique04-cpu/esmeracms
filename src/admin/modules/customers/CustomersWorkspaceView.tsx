/* eslint-disable react-hooks/error-boundaries -- Query failures are handled here; render failures remain handled by the Next.js/Payload boundaries. */
import Link from 'next/link'
import type { AdminViewServerProps, Where } from 'payload'

import {
  DataSection,
  MetricStrip,
  MetricStripItem,
  SectionNav,
  SectionNavLink,
  SplitWorkspace,
  Status,
} from '../../design-system'
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
        sort: '-updatedAt', limit: 300, depth: 1, where: customerWhere(filters, relatedIds),
        select: { id: true, name: true, company: true, phone: true, email: true, city: true, state: true, status: true, origin: true, owner: true, createdAt: true, updatedAt: true },
      }),
      findDocs<Omit<CustomerListItem, 'purchaseCount' | 'lifetimeValueCents'>>(req, 'customers', {
        sort: 'name', limit: 500, depth: 1, where: { status: { not_equals: 'archived' } } as Where,
        select: { id: true, name: true, company: true, phone: true, email: true, city: true, state: true, status: true, origin: true, owner: true, createdAt: true, updatedAt: true },
      }),
      findDocs<UserRef>(req, 'users', { sort: 'name', limit: 100, depth: 0, select: { id: true, name: true, email: true } }),
      findDocs<CategoryRef>(req, 'categories', { sort: 'order', limit: 500, depth: 0, draft: true, select: { id: true, title: true, slug: true } }),
      findDocs<ProductRef>(req, 'products', { sort: 'title', limit: 500, depth: 0, draft: true, where: { catalogStatus: { equals: 'active' } } as Where, select: { id: true, title: true, code: true, catalogStatus: true, availability: true } }),
    ])

    const visibleIds = customerResult.docs.map((customer) => customer.id)
    const listSales = visibleIds.length ? await findDocs<SaleSummary & { customer?: unknown }>(req, 'sales', {
      sort: '-confirmedAt', limit: 1000, depth: 0, where: { customer: { in: visibleIds } } as Where,
      select: { id: true, customer: true, status: true, totalCents: true, confirmedAt: true, updatedAt: true },
    }) : { docs: [], totalDocs: 0 }

    const listItems: CustomerListItem[] = customerResult.docs.map((customer) => {
      const customerSales = listSales.docs.filter((sale) => String(relationId(sale.customer)) === String(customer.id) && purchaseStatuses.has(sale.status || ''))
      return {
        ...customer,
        status: customer.status || 'active',
        purchaseCount: customerSales.length,
        lifetimeValueCents: customerSales.reduce((sum, sale) => sum + (sale.totalCents || 0), 0),
        lastActivityAt: latestDate([customer.updatedAt, ...customerSales.map((sale) => sale.confirmedAt || sale.updatedAt)]),
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
        findDocs<OpportunitySummary>(req, 'opportunities', { sort: 'rank', limit: 300, depth: 0, where: { customer: { equals: selectedId } } as Where, select: { id: true, stage: true, estimatedValueCents: true, nextAction: true, nextActionAt: true } }),
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

    const detailContent = detail ? <section className="esmera-customer-detail">
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
          <Link className="esmera-button" href={`/admin/sales?view=list&customer=${detail.id}`}>Contexto comercial</Link>
          {role === 'admin' ? <CustomerMergeDialog source={detail} customers={mergeCandidates} /> : null}
          <TechnicalLink href={`/admin/collections/customers/${detail.id}`}>Admin técnico</TechnicalLink>
        </div>
      </header>

      <MetricStrip columns={4} className="esmera-customer-summary-grid" label="Resumo do cliente">
        <MetricStripItem label="Compras" value={selectedPurchases.length} meta={lastPurchase ? `Última em ${shortDate(lastPurchase.confirmedAt || lastPurchase.updatedAt)}` : 'Nenhuma compra confirmada'} />
        <MetricStripItem label="Valor histórico" value={money(lifetimeValue)} meta="Somente vendas confirmadas ou posteriores" tone="success" />
        <MetricStripItem label="Interesses ativos" value={interests.filter((interest) => ['active', 'curation', 'paused'].includes(interest.status || '')).length} meta="Associações explícitas a produtos" />
        <MetricStripItem label="Oportunidades abertas" value={openOpportunities.length} meta={openOpportunities.length ? `${money(openOpportunityValue)} de potencial informado` : 'Nenhuma negociação aberta'} tone={openOpportunities.length ? 'info' : 'neutral'} />
      </MetricStrip>

      <SectionNav className="esmera-customer-tabs" label="Seções do cliente">{tabs.map((item) => <SectionNavLink key={item} active={tab === item} href={tabHref(filters, detail!.id, item)}>{customerTabLabels[item]}</SectionNavLink>)}</SectionNav>

      {tab === 'overview' ? <div className="esmera-customer-overview">
        <DataSection compact eyebrow="Próxima ação" title={nextTask?.title || 'Nenhuma tarefa aberta'} description={nextTask ? `${dateTime(nextTask.dueAt)} · ${relationLabel(nextTask.assignee, 'sem responsável')}` : 'Crie uma tarefa real quando houver um próximo passo definido.'} action={nextTask ? <TechnicalLink href={`/admin/collections/tasks/${nextTask.id}`}>Abrir tarefa</TechnicalLink> : <TechnicalLink href="/admin/collections/tasks/create">Nova tarefa</TechnicalLink>}><div /></DataSection>
        <DataSection eyebrow="Perfil" title="Identidade e interesse" description="Status do cliente é independente da etapa de qualquer oportunidade comercial."><CustomerProfileEditor customer={detail} users={usersResult.docs} categories={categoriesResult.docs} /></DataSection>
      </div> : null}

      {tab === 'history' ? <DataSection eyebrow="Event stream" title="Histórico relacional" description="Activities é append-mostly: operadores criam eventos; somente administradores alteram o passado.">{!activities.length ? <EmptyState title="Nenhuma atividade registrada" copy="Notas, interesses e mudanças comerciais passam a compor esta timeline." /> : <ol className="esmera-customer-timeline">{activities.map((activity) => <li key={String(activity.id)}><span className="esmera-customer-timeline__marker" aria-hidden="true" /><div><span>{activityLabel(activity)}</span><strong>{activity.summary || activityLabel(activity)}</strong>{activity.details ? <p>{activity.details}</p> : null}<small>{dateTime(activity.occurredAt)} · {relationLabel(activity.owner, 'sistema')}</small></div></li>)}</ol>}</DataSection> : null}

      {tab === 'interests' ? <DataSection eyebrow="Curadoria" title="Interesses explícitos" description="Relações com produto ficam em ClientInterests para preservar status e histórico por interesse."><CustomerInterestComposer customerId={detail.id} products={productsResult.docs} interests={interests} /></DataSection> : null}

      {tab === 'sales' ? <DataSection eyebrow="Comercial" title="Vendas do cliente" description={`${sales.length} registro${sales.length === 1 ? '' : 's'} relacionado${sales.length === 1 ? '' : 's'}.`}>{!sales.length ? <EmptyState title="Nenhuma venda" copy="As vendas relacionadas aparecerão aqui automaticamente." /> : <div className="esmera-data-table-wrap"><table className="esmera-data-table"><thead><tr><th>Venda</th><th>Status</th><th>Total</th><th>Data</th><th /></tr></thead><tbody>{sales.map((sale) => <tr key={String(sale.id)}><td><strong>{sale.number || sale.id}</strong></td><td><Status tone={statusTone(sale.status)}>{saleStatusLabels[sale.status || ''] || sale.status || '—'}</Status></td><td>{money(sale.totalCents)}</td><td>{shortDate(sale.confirmedAt || sale.updatedAt)}</td><td><Link href={`/admin/sales?view=list&sale=${sale.id}`}>Abrir</Link></td></tr>)}</tbody></table></div>}</DataSection> : null}

      {tab === 'after-sales' ? <DataSection eyebrow="Continuidade" title="Pós-venda" description="Entrega, follow-ups e ocorrências vinculados ao cliente.">{!afterSales.length ? <EmptyState title="Nenhum pós-venda" copy="Casos criados a partir de vendas aparecerão aqui automaticamente." /> : <div className="esmera-data-table-wrap"><table className="esmera-data-table"><thead><tr><th>Venda</th><th>Status</th><th>Prioridade</th><th>Entrega</th><th /></tr></thead><tbody>{afterSales.map((item) => <tr key={String(item.id)}><td>{typeof item.sale === 'object' && item.sale ? item.sale.number || item.sale.id : relationId(item.sale) || '—'}</td><td><Status tone={statusTone(item.status)}>{item.status || '—'}</Status></td><td>{item.priority || '—'}</td><td>{shortDate(item.deliveredAt || item.expectedDeliveryAt)}</td><td><Link href={`/admin/collections/after-sales/${item.id}`}>Abrir</Link></td></tr>)}</tbody></table></div>}</DataSection> : null}

      {tab === 'notes' ? <DataSection eyebrow="Registro" title="Notas" description="Novas notas são eventos imutáveis para o operador e entram na timeline."><CustomerNoteComposer customerId={detail.id} />{!noteActivities.length ? <EmptyState title="Nenhuma nota" copy="Registre apenas contexto relevante para o relacionamento." /> : <ul className="esmera-customer-notes">{noteActivities.map((activity) => <li key={String(activity.id)}><p>{activity.details || activity.summary}</p><small>{dateTime(activity.occurredAt)} · {relationLabel(activity.owner, 'sistema')}</small></li>)}</ul>}</DataSection> : null}
    </section> : undefined

    return <ViewFrame props={props} width="wide">
      <PageHeader eyebrow="Relacionamento" title="Clientes" subtitle="Workspace relacional para entender identidade, interesses, oportunidades, vendas, pós-venda, tarefas e histórico sem abrir múltiplas Collections." actions={<><CustomerCreateDialog /><TechnicalLink href="/admin/collections/customers">Admin técnico</TechnicalLink></>} />
      <SplitWorkspace
        className="esmera-customers-workspace"
        hasDetail={Boolean(detail)}
        master={<CustomerMasterList customers={listItems} filters={filters} selectedId={selectedId} users={usersResult.docs} />}
        detail={detailContent}
      />
    </ViewFrame>
  } catch (error) {
    return <ViewFrame props={props} width="wide"><PageHeader title="Clientes" subtitle="Relacionamento" /><QueryError title="Não foi possível consultar clientes" error={error} /></ViewFrame>
  }
}
