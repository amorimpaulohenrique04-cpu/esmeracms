import type { PayloadRequest, Where } from 'payload'

import { eligibleSaleStatuses } from '../../collections/Sales'

type ProductSummary = {
  id: string | number
  title?: string | null
  code?: string | null
  updatedAt?: string | null
}

type TaskSummary = {
  id: string | number
  title?: string | null
  dueAt?: string | null
  priority?: string | null
  status?: string | null
}

type SaleSummary = { totalCents?: number | null }
type FollowUp = { status?: string | null; dueAt?: string | null }
type AfterSaleSummary = { followUps?: FollowUp[] | null }

async function count(req: PayloadRequest, collection: string, where?: Where) {
  const result = await req.payload.count({
    collection: collection as never,
    where,
    overrideAccess: false,
    user: req.user,
    req,
  })
  return result.totalDocs
}

async function findAllSelected<T>(
  req: PayloadRequest,
  collection: string,
  where: Where | undefined,
  select: Record<string, true>,
) {
  const docs: T[] = []
  let page = 1
  let hasNextPage = true

  while (hasNextPage) {
    const result = await req.payload.find({
      collection: collection as never,
      where,
      select: select as never,
      limit: 250,
      page,
      depth: 0,
      overrideAccess: false,
      user: req.user,
      req,
    })
    docs.push(...(result.docs as unknown as T[]))
    hasNextPage = result.hasNextPage
    page += 1
  }

  return docs
}

export async function getCatalogHealth(req: PayloadRequest) {
  const [publishedActive, drafts, latestResult] = await Promise.all([
    count(req, 'products', {
      and: [{ catalogStatus: { equals: 'active' } }, { _status: { equals: 'published' } }],
    } as Where),
    count(req, 'products', { _status: { equals: 'draft' } } as Where),
    req.payload.find({
      collection: 'products',
      sort: '-updatedAt',
      limit: 1,
      depth: 0,
      select: { title: true, code: true, updatedAt: true },
      overrideAccess: false,
      user: req.user,
      req,
    }),
  ])

  return {
    publishedActive,
    drafts,
    latest: (latestResult.docs[0] as ProductSummary | undefined) ?? null,
  }
}

export async function getOpenLeadSummary(req: PayloadRequest) {
  const stages = ['new', 'curation', 'proposal', 'negotiation'] as const
  const [open, stageCounts] = await Promise.all([
    count(req, 'leads', { stage: { in: [...stages] } } as Where),
    Promise.all(stages.map((stage) => count(req, 'leads', { stage: { equals: stage } } as Where))),
  ])

  return {
    open,
    stages: stages.map((stage, index) => ({ stage, count: stageCounts[index] })),
  }
}

export async function getMonthlySalesSummary(req: PayloadRequest, fromISO: string) {
  const sales = await findAllSelected<SaleSummary>(
    req,
    'sales',
    {
      and: [
        { status: { in: [...eligibleSaleStatuses] } },
        { confirmedAt: { greater_than_equal: fromISO } },
      ],
    } as Where,
    { totalCents: true },
  )

  return {
    count: sales.length,
    revenueCents: sales.reduce((sum, sale) => sum + (sale.totalCents || 0), 0),
  }
}

export async function getDueTaskSummary(req: PayloadRequest, limit = 6) {
  const result = await req.payload.find({
    collection: 'tasks',
    where: { status: { in: ['pending', 'in_progress'] } },
    sort: 'dueAt',
    limit,
    depth: 0,
    select: { title: true, dueAt: true, priority: true, status: true },
    overrideAccess: false,
    user: req.user,
    req,
  })

  return result.docs as unknown as TaskSummary[]
}

export async function getAfterSalesSummary(req: PayloadRequest, dueUntilISO: string) {
  const candidates = await findAllSelected<AfterSaleSummary>(
    req,
    'after-sales',
    {
      and: [
        { 'followUps.status': { equals: 'pending' } },
        { 'followUps.dueAt': { less_than_equal: dueUntilISO } },
      ],
    } as Where,
    { followUps: true },
  )

  const dueFollowUps = candidates.flatMap((item) => item.followUps || []).filter((followUp) => {
    if (followUp.status !== 'pending' || !followUp.dueAt) return false
    return new Date(followUp.dueAt).getTime() <= new Date(dueUntilISO).getTime()
  })

  return { dueFollowUps: dueFollowUps.length }
}
