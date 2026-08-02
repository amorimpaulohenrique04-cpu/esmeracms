import type { PayloadRequest, Where } from 'payload'

import { canManageBusiness, canManageSite } from '../../access/roles'
import { countDocs, findDocs } from '../domain/shared/payload'
import { getDashboardReporting } from '../reporting'

const DASHBOARD_TIME_ZONE = 'America/Recife'
const openTaskStatuses = ['pending', 'in_progress'] as const

export type DashboardProduct = {
  id: string | number
  title?: string | null
  code?: string | null
  catalogStatus?: string | null
  availability?: string | null
  publicationReady?: boolean | null
  _status?: string | null
  updatedAt?: string | null
}

export type DashboardRelationValue = {
  id?: string | number
  code?: string | null
  number?: string | null
  caseNumber?: string | null
  trackingCode?: string | null
  name?: string | null
}

export type DashboardTaskRelation = {
  relationTo?: string | null
  value?: string | number | DashboardRelationValue | null
}

export type DashboardTask = {
  id: string | number
  title?: string | null
  dueAt?: string | null
  priority?: string | null
  status?: string | null
  type?: string | null
  relatedTo?: DashboardTaskRelation[] | null
}

function localDayParts(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DASHBOARD_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now)

  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const day = Number(parts.find((part) => part.type === 'day')?.value)
  if (!year || !month || !day) throw new Error('Não foi possível determinar o dia operacional do Dashboard.')
  return { year, month, day }
}

export function dashboardDayBounds(now = new Date()) {
  const { year, month, day } = localDayParts(now)
  const start = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0))
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

function openTaskWhere(): Where {
  return { status: { in: [...openTaskStatuses] } } as Where
}

function taskWindowWhere(from: string | null, to: string): Where {
  const dueAt: Record<string, string> = { less_than: to }
  if (from) dueAt.greater_than_equal = from
  return {
    and: [openTaskWhere(), { dueAt } as Where],
  } as Where
}

export async function getDashboardSnapshot(req: PayloadRequest, now = new Date()) {
  const siteAllowed = canManageSite(req.user)
  const businessAllowed = canManageBusiness(req.user)
  const day = dashboardDayBounds(now)
  const generatedAt = now.toISOString()

  const catalogPromise = Promise.all([
    countDocs(req, 'products', {
      and: [
        { catalogStatus: { equals: 'active' } },
        { _status: { equals: 'published' } },
      ],
    } as Where),
    siteAllowed
      ? countDocs(req, 'products', {
          and: [
            { _status: { equals: 'draft' } },
            { publicationReady: { equals: false } },
          ],
        } as Where)
      : Promise.resolve(0),
    findDocs<DashboardProduct>(req, 'products', {
      sort: '-updatedAt',
      limit: 5,
      depth: 0,
      draft: siteAllowed,
      select: {
        id: true,
        title: true,
        code: true,
        catalogStatus: true,
        availability: true,
        publicationReady: true,
        _status: true,
        updatedAt: true,
      },
    }),
  ])

  const businessPromise = businessAllowed
    ? Promise.all([
        getDashboardReporting(req),
        countDocs(req, 'tasks', openTaskWhere()),
        countDocs(req, 'tasks', taskWindowWhere(null, generatedAt)),
        countDocs(req, 'tasks', taskWindowWhere(generatedAt, day.end)),
        findDocs<DashboardTask>(req, 'tasks', {
          where: openTaskWhere(),
          sort: 'dueAt',
          limit: 6,
          depth: 2,
          select: {
            id: true,
            title: true,
            dueAt: true,
            priority: true,
            status: true,
            type: true,
            relatedTo: true,
          },
        }),
      ])
    : Promise.resolve(null)

  const [catalog, business] = await Promise.all([catalogPromise, businessPromise])

  return {
    generatedAt,
    timeZone: DASHBOARD_TIME_ZONE,
    permissions: { site: siteAllowed, business: businessAllowed },
    catalog: {
      activeProducts: catalog[0],
      editorialPending: catalog[1],
      recentProducts: catalog[2].docs,
    },
    business: business
      ? {
          reporting: business[0],
          tasks: {
            open: business[1],
            overdue: business[2],
            dueToday: business[3],
            items: business[4].docs,
          },
        }
      : null,
    traffic: {
      configured: false as const,
      reason: 'Nenhuma integração de Analytics com contrato verificável foi configurada.',
    },
  }
}

export type DashboardSnapshot = Awaited<ReturnType<typeof getDashboardSnapshot>>
