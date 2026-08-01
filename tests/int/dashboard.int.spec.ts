import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload, type PayloadRequest } from 'payload'

import config from '@/payload.config'
import type { Customer, Opportunity, Product, Task, User } from '@/payload-types'
import { dashboardDayBounds, getDashboardSnapshot } from '@/server/dashboard'

let payload: Payload
let user: User
let customer: Customer
let product: Product
let opportunity: Opportunity
const tasks: Task[] = []

const stamp = `dashboard-${Date.now().toString(36)}`
const now = new Date()

function requestFor(currentUser: User): PayloadRequest {
  return { payload, user: currentUser } as PayloadRequest
}

describe('Dashboard final operational snapshot', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    user = await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        email: `${stamp}@esmera.test`,
        password: 'test-password-123',
        name: 'Dashboard Admin',
        role: 'admin',
      },
    })

    customer = await payload.create({
      collection: 'customers',
      overrideAccess: true,
      data: { name: `Cliente ${stamp}`, email: `${stamp}@example.com` },
    })

    product = await payload.create({
      collection: 'products',
      overrideAccess: true,
      draft: true,
      data: {
        title: `Produto ${stamp}`,
        slug: `produto-${stamp}`,
        code: `DASH-${stamp}`.toUpperCase(),
        catalogStatus: 'archived',
        availability: 'available',
        priceMode: 'inquiry',
      },
    })

    opportunity = await payload.create({
      collection: 'opportunities',
      overrideAccess: true,
      data: {
        customer: customer.id,
        owner: user.id,
        source: 'site',
        stage: 'new',
        priority: 'normal',
        interestedProducts: [product.id],
      } as never,
    })

    const day = dashboardDayBounds(now)
    const end = new Date(day.end).getTime()
    const dueToday = new Date(Math.min(now.getTime() + 60 * 60 * 1000, end - 60_000)).toISOString()

    tasks.push(await payload.create({
      collection: 'tasks',
      overrideAccess: true,
      data: {
        title: `Atrasada ${stamp}`,
        type: 'custom',
        status: 'pending',
        priority: 'urgent',
        dueAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        relatedTo: [{ relationTo: 'opportunities', value: opportunity.id }],
      } as never,
    }))

    tasks.push(await payload.create({
      collection: 'tasks',
      overrideAccess: true,
      data: {
        title: `Hoje ${stamp}`,
        type: 'custom',
        status: 'in_progress',
        priority: 'normal',
        dueAt: dueToday,
        relatedTo: [{ relationTo: 'customers', value: customer.id }],
      } as never,
    }))
  }, 180_000)

  afterAll(async () => {
    if (!payload) return
    for (const task of tasks.reverse()) await payload.delete({ collection: 'tasks', id: task.id, overrideAccess: true })

    if (opportunity) {
      const activities = await payload.find({
        collection: 'activities',
        overrideAccess: true,
        pagination: false,
        where: { opportunity: { equals: opportunity.id } } as never,
      })
      for (const activity of activities.docs) {
        await payload.delete({ collection: 'activities', id: activity.id, overrideAccess: true })
      }
      await payload.delete({ collection: 'opportunities', id: opportunity.id, overrideAccess: true })
    }
    if (customer) await payload.delete({ collection: 'customers', id: customer.id, overrideAccess: true })
    if (product) await payload.delete({ collection: 'products', id: product.id, overrideAccess: true })
    if (user) await payload.delete({ collection: 'users', id: user.id, overrideAccess: true })
  }, 60_000)

  it('combines reporting, real tasks and recent catalog without traffic placeholders', async () => {
    const snapshot = await getDashboardSnapshot(requestFor(user), now)

    expect(snapshot.permissions).toEqual({ site: true, business: true })
    expect(snapshot.catalog.recentProducts.some((item) => item.id === product.id)).toBe(true)
    expect(snapshot.business?.reporting.pipeline.find((item) => item.stage === 'new')?.volume).toBeGreaterThanOrEqual(1)
    expect(snapshot.business?.tasks.open).toBeGreaterThanOrEqual(2)
    expect(snapshot.business?.tasks.overdue).toBeGreaterThanOrEqual(1)
    expect(snapshot.business?.tasks.dueToday).toBeGreaterThanOrEqual(1)
    expect(snapshot.business?.tasks.items.some((item) => item.id === tasks[0].id)).toBe(true)
    expect(snapshot.traffic).toMatchObject({ configured: false })
  })
})
