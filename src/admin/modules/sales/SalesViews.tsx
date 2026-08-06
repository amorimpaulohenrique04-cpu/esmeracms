/* eslint-disable react-hooks/error-boundaries -- Query failures are handled here; render failures remain handled by the Next.js/Payload boundaries. */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps, Where } from 'payload'

import { openOpportunityStages, opportunityStages } from '../../../businessRules/opportunities/stages'
import { eligibleSaleStatuses } from '../../../collections/Sales'
import { SegmentedControl, SegmentedControlLink } from '../../design-system'
import {
  AccessDenied,
  ensureUser,
  findDocs,
  PageHeader,
  QueryError,
  TechnicalLink,
  ViewFrame,
} from '../../views/shared'
import { SaleCreateDialog, SalesWorkspaceClient } from './SalesWorkspaceClient'
import './sale-create-dialog.scss'
import type {
  ActivityRecord,
  OpportunityPeriod,
  OpportunityRecord,
  ProductRef,
  SalesMode,
  SalesTransaction,
  SalesWorkspaceFilters,
  UserRef,
} from './types'

type CustomerID = { id: string | number }

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

async function paramsOf(props: AdminViewServerProps) {
  return await Promise.resolve(props.searchParams as unknown as Record<string, string | string[] | undefined>)
}

function filtersFrom(params: Record<string, string | string[] | undefined>): SalesWorkspaceFilters {
  const view: SalesMode = first(params.view) === 'pipeline' ? 'pipeline' : 'list'
  const periodValue = first(params.period)
  const period: OpportunityPeriod = periodValue && ['all', 'overdue', 'today', '7d', '30d'].includes(periodValue)
    ? periodValue as OpportunityPeriod
    : 'all'
  const stageValue = first(params.stage) || ''
  const limitValue = positiveInt(first(params.limit), 50)
  const limit = ([25, 50, 100].includes(limitValue) ? limitValue : 50) as 25 | 50 | 100
  return {
    view,
    q: (first(params.q) || '').trim().slice(0, 120),
    owner: (first(params.owner) || '').trim(),
    source: (first(params.source) || '').trim(),
    stage: opportunityStages.includes(stageValue as typeof opportunityStages[number]) ? stageValue : '',
    period,
    page: positiveInt(first(params.page), 1),
    limit,
    sort: (first(params.sort) || 'updatedAt:desc').trim(),
  }
}

function dayBounds(offsetDays = 0) {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Recife',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value) - 1
  const day = Number(parts.find((part) => part.type === 'day')?.value)
  const start = new Date(Date.UTC(year, month, day + offsetDays, 3, 0, 0, 0))
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start: start.toISOString(), end: end.toISOString() }
}

function opportunityWhere(filters: SalesWorkspaceFilters, customerIds: Array<string | number>): Where {
  const and: Where[] = []
  if (filters.view === 'pipeline') and.push({ stage: { in: [...openOpportunityStages] } } as Where)
  else if (filters.stage) and.push({ stage: { equals: filters.stage } } as Where)
  if (filters.owner) and.push({ owner: { equals: filters.owner } } as Where)
  if (filters.source) and.push({ source: { equals: filters.source } } as Where)
  if (filters.q) {
    const or: Where[] = [
      { code: { like: filters.q } },
      { nextAction: { like: filters.q } },
      { lossNotes: { like: filters.q } },
    ] as Where[]
    if (customerIds.length) or.push({ customer: { in: customerIds } } as Where)
    and.push({ or } as Where)
  }

  const today = dayBounds()
  if (filters.period === 'overdue') {
    and.push({ nextActionAt: { less_than: new Date().toISOString() } } as Where)
    and.push({ stage: { in: [...openOpportunityStages] } } as Where)
  } else if (filters.period === 'today') {
    and.push({ nextActionAt: { greater_than_equal: today.start, less_than: today.end } } as Where)
  } else if (filters.period === '7d' || filters.period === '30d') {
    const days = filters.period === '7d' ? 7 : 30
    and.push({ nextActionAt: { greater_than_equal: new Date().toISOString(), less_than: dayBounds(days).start } } as Where)
  }
  return and.length ? { and } as Where : {}
}

function payloadSort(sort: string) {
  const [field, direction] = sort.split(':')
  const allowed = new Set(['updatedAt', 'createdAt', 'nextActionAt', 'estimatedValueCents', 'code', 'stage', 'rank'])
  const safe = allowed.has(field) ? field : 'updatedAt'
  return direction === 'asc' ? safe : `-${safe}`
}

function ViewSwitch({ filters }: { filters: SalesWorkspaceFilters }) {
  const list = new URLSearchParams()
  const pipeline = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (key === 'view' || key === 'page' || !value || value === 'all' || value === 50 || value === 'updatedAt:desc') continue
    list.set(key, String(value))
    pipeline.set(key, String(value))
  }
  list.set('view', 'list')
  pipeline.set('view', 'pipeline')
  return <SegmentedControl className="esmera-sales-switch" label="Visualização de vendas">
    <SegmentedControlLink selected={filters.view === 'list'} href={`/admin/sales?${list.toString()}`}>Lista</SegmentedControlLink>
    <SegmentedControlLink selected={filters.view === 'pipeline'} href={`/admin/sales?${pipeline.toString()}`}>Pipeline</SegmentedControlLink>
  </SegmentedControl>
}

export async function SalesWorkspace(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'business')
  if (!allowed) return <AccessDenied props={props} area="comercial" />

  const filters = filtersFrom(await paramsOf(props))
  const req = props.initPageResult.req

  try {
    let matchingCustomers: CustomerID[] = []
    if (filters.q) {
      const result = await findDocs<CustomerID>(req, 'customers', {
        depth: 0,
        limit: 200,
        where: { or: [{ name: { like: filters.q } }, { company: { like: filters.q } }, { phone: { like: filters.q } }, { email: { like: filters.q } }] } as Where,
        select: { id: true },
      })
      matchingCustomers = result.docs
    }

    const queryPage = filters.view === 'pipeline' ? 1 : filters.page
    const queryLimit = filters.view === 'pipeline' ? 500 : filters.limit
    const [opportunityResult, usersResult, productsResult, transactionsResult] = await Promise.all([
      findDocs<OpportunityRecord>(req, 'opportunities', {
        sort: filters.view === 'pipeline' ? 'rank' : payloadSort(filters.sort),
        page: queryPage,
        limit: queryLimit,
        depth: 2,
        where: opportunityWhere(filters, matchingCustomers.map((customer) => customer.id)),
        select: {
          id: true, code: true, stage: true, rank: true, customer: true, owner: true, source: true, priority: true,
          interestedProducts: true, estimatedValueCents: true, nextAction: true, nextActionAt: true, expectedCloseAt: true,
          closedAt: true, lossReason: true, lossNotes: true, wonSale: true, createdAt: true, updatedAt: true,
        },
      }),
      findDocs<UserRef>(req, 'users', { sort: 'name', limit: 100, depth: 0, select: { id: true, name: true, email: true } }),
      findDocs<ProductRef>(req, 'products', {
        sort: 'title', limit: 500, depth: 0, draft: true, where: { catalogStatus: { equals: 'active' } } as Where,
        select: { id: true, title: true, code: true, slug: true, priceMode: true, basePriceCents: true, variants: true },
      }),
      findDocs<SalesTransaction>(req, 'sales', {
        sort: '-confirmedAt', limit: 30, depth: 1, where: { status: { in: [...eligibleSaleStatuses] } } as Where,
        select: { id: true, number: true, status: true, totalCents: true, channel: true, customer: true, opportunity: true, confirmedAt: true, expectedDeliveryAt: true, updatedAt: true },
      }),
    ])

    const opportunityIds = opportunityResult.docs.map((opportunity) => opportunity.id)
    const activitiesResult = opportunityIds.length ? await findDocs<ActivityRecord>(req, 'activities', {
      sort: '-occurredAt', limit: 1000, depth: 1, where: { opportunity: { in: opportunityIds } } as Where,
      select: { id: true, eventType: true, summary: true, details: true, occurredAt: true, fromStage: true, toStage: true, lossReason: true, owner: true, opportunity: true },
    }) : { docs: [], totalDocs: 0 }

    return <ViewFrame props={props} width="fluid">
      <PageHeader
        className="esmera-sales-command-bar"
        eyebrow="Comercial"
        title="Vendas"
        subtitle="Lista e Pipeline usam o mesmo domínio de Opportunities. Ganhos criam Sales transacionais; Leads permanecem restritos à aquisição e qualificação."
        actions={<><TechnicalLink href="/admin/collections/opportunities/create" primary>Nova oportunidade</TechnicalLink><SaleCreateDialog products={productsResult.docs} /><TechnicalLink href="/admin/collections/sales">Vendas confirmadas</TechnicalLink></>}
        context={<ViewSwitch filters={filters} />}
      />
      <SalesWorkspaceClient
        opportunities={opportunityResult.docs}
        activities={activitiesResult.docs}
        products={productsResult.docs}
        users={usersResult.docs}
        transactions={transactionsResult.docs}
        filters={filters}
        totalDocs={opportunityResult.totalDocs}
        totalPages={opportunityResult.totalPages || 1}
      />
    </ViewFrame>
  } catch (error) {
    return <ViewFrame props={props} width="fluid"><PageHeader title="Vendas" subtitle="Comercial" /><QueryError title="Não foi possível consultar o workspace de Vendas" error={error} /></ViewFrame>
  }
}

export function PipelineRedirect() {
  redirect('/admin/sales?view=pipeline')
}
