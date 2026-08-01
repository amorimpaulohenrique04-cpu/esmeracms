import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'

import config from '@/payload.config'
import type {
  AfterSale,
  Customer,
  PayloadJob,
  Product,
  Sale,
  Shipment,
  Task,
  User,
} from '@/payload-types'
import { CREATE_AFTER_SALES_TASK_JOB } from '@/server/jobs'

let payload: Payload
let commercialUser: User
const stamp = Date.now().toString(36)
const created = {
  users: [] as User['id'][],
  customers: [] as Customer['id'][],
  products: [] as Product['id'][],
  sales: [] as Sale['id'][],
  afterSales: [] as AfterSale['id'][],
  shipments: [] as Shipment['id'][],
  tasks: [] as Task['id'][],
  jobs: [] as PayloadJob['id'][],
}

async function remove(collection: keyof typeof created, ids: Array<string | number>) {
  const slug = collection === 'afterSales' ? 'after-sales' : collection === 'jobs' ? 'payload-jobs' : collection
  for (const id of [...ids].reverse()) {
    try {
      await payload.delete({ collection: slug, id, overrideAccess: true } as never)
    } catch {
      // The isolated CI database may already have removed a related document.
    }
  }
}

type JobSnapshot = PayloadJob & {
  input?: { automationKey?: string }
  waitUntil?: string | null
}

function automationKey(job: JobSnapshot) {
  return job.input?.automationKey || ''
}

describe('Stage 11 Payload Jobs Queue', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    commercialUser = await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        email: `jobs-${stamp}@esmera.test`,
        password: 'test-password-123',
        name: `Jobs ${stamp}`,
        role: 'commercial',
      },
    })
    created.users.push(commercialUser.id)
  }, 180_000)

  afterAll(async () => {
    if (!payload) return
    await remove('jobs', created.jobs)
    await payload.delete({
      collection: 'activities',
      overrideAccess: true,
      where: {
        or: [
          { summary: { contains: stamp } },
          { details: { contains: stamp } },
        ],
      },
    })
    await remove('tasks', created.tasks)
    await remove('shipments', created.shipments)
    await remove('afterSales', created.afterSales)
    await remove('sales', created.sales)
    await remove('products', created.products)
    await remove('customers', created.customers)
    await remove('users', created.users)
  }, 60_000)

  it('queues D+3, D+15 and D+90 and executes an idempotent durable task', async () => {
    const customer = await payload.create({
      collection: 'customers',
      overrideAccess: true,
      data: { name: `Cliente Jobs ${stamp}`, email: `jobs-${stamp}@example.com` },
    })
    created.customers.push(customer.id)

    const product = await payload.create({
      collection: 'products',
      overrideAccess: true,
      draft: true,
      data: {
        title: `Objeto Jobs ${stamp}`,
        code: `JOB-${stamp}`.toUpperCase(),
        slug: `objeto-jobs-${stamp}`,
        catalogStatus: 'active',
        availability: 'available',
        priceMode: 'fixed',
        basePriceCents: 240_000,
        _status: 'draft',
      },
    })
    created.products.push(product.id)

    await payload.updateGlobal({
      slug: 'after-sales-automation',
      overrideAccess: true,
      data: {
        preparationEnabled: true,
        preparationDelayHours: 0,
        satisfactionEnabled: true,
        satisfactionDelayDays: 3,
        testimonialEnabled: true,
        testimonialDelayDays: 15,
        maintenanceEnabled: true,
        maintenanceDelayDays: 90,
        maintenanceScope: 'selected',
        maintenanceProducts: [product.id],
        maintenanceCategories: [],
      } as never,
    })

    const sale = await payload.create({
      collection: 'sales',
      overrideAccess: true,
      user: commercialUser,
      context: { skipJobScheduling: true },
      data: {
        number: `SALE-JOBS-${stamp}`.toUpperCase(),
        customer: customer.id,
        channel: 'whatsapp',
        status: 'draft',
        owner: commercialUser.id,
        items: [{ product: product.id, quantity: 1 }],
        discountCents: 0,
        shippingCents: 0,
        expectedDeliveryAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      } as never,
    })
    created.sales.push(sale.id)

    await payload.update({
      collection: 'sales',
      id: sale.id,
      overrideAccess: true,
      user: commercialUser,
      data: { status: 'confirmed' },
    })

    const afterSales = await payload.create({
      collection: 'after-sales',
      overrideAccess: true,
      user: commercialUser,
      context: { skipJobScheduling: true },
      data: {
        sale: sale.id,
        customer: customer.id,
        status: 'open',
        priority: 'normal',
        owner: commercialUser.id,
        summary: `Caso Jobs ${stamp}`,
      } as never,
    })
    created.afterSales.push(afterSales.id)

    const shipment = await payload.create({
      collection: 'shipments',
      overrideAccess: true,
      user: commercialUser,
      context: { skipJobScheduling: true },
      data: {
        afterSalesCase: afterSales.id,
        carrier: `Transportadora Jobs ${stamp}`,
        trackingCode: `TRACK-JOBS-${stamp}`.toUpperCase(),
        status: 'confirmed',
        lastEvent: `Coleta Jobs ${stamp}`,
      } as never,
    })
    created.shipments.push(shipment.id)

    const deliveredAt = new Date().toISOString()
    await payload.update({
      collection: 'shipments',
      id: shipment.id,
      overrideAccess: true,
      user: commercialUser,
      data: {
        status: 'delivered',
        deliveredAt,
        lastEvent: `Entrega Jobs ${stamp}`,
      } as never,
    })

    const jobsResult = await payload.find({
      collection: 'payload-jobs',
      overrideAccess: true,
      depth: 0,
      limit: 200,
      pagination: false,
      where: { queue: { equals: 'operational' } },
    })
    const saleJobs = (jobsResult.docs as JobSnapshot[]).filter((job) => automationKey(job).startsWith(`sale:${sale.id}:`))
    created.jobs.push(...saleJobs.map((job) => job.id))

    const keys = saleJobs.map(automationKey)
    expect(keys).toContain(`sale:${sale.id}:preparation:v1`)
    expect(keys).toContain(`sale:${sale.id}:satisfaction:v1`)
    expect(keys).toContain(`sale:${sale.id}:testimonial:v1`)
    expect(keys).toContain(`sale:${sale.id}:maintenance:v1`)

    const base = new Date(deliveredAt).getTime()
    const expectedDays: Record<string, number> = {
      [`sale:${sale.id}:satisfaction:v1`]: 3,
      [`sale:${sale.id}:testimonial:v1`]: 15,
      [`sale:${sale.id}:maintenance:v1`]: 90,
    }
    for (const [key, days] of Object.entries(expectedDays)) {
      const job = saleJobs.find((item) => automationKey(item) === key)
      expect(job?.waitUntil).toBeTruthy()
      const expected = base + days * 86_400_000
      expect(Math.abs(new Date(job?.waitUntil || 0).getTime() - expected)).toBeLessThan(2_000)
    }

    const uniqueQueue = `stage11-${stamp}`
    const taskKey = `stage11:${stamp}:idempotent`
    const firstJob = await payload.jobs.queue({
      task: CREATE_AFTER_SALES_TASK_JOB,
      queue: uniqueQueue,
      waitUntil: new Date(Date.now() - 1_000),
      input: {
        automationKey: taskKey,
        saleId: String(sale.id),
        title: `Follow-up idempotente ${stamp}`,
        type: 'satisfaction',
        dueAt: new Date().toISOString(),
        priority: 'normal',
        assigneeId: String(commercialUser.id),
        notes: `Jobs Queue ${stamp}`,
      },
    } as never)
    created.jobs.push(firstJob.id)
    await payload.jobs.runByID({ id: firstJob.id })

    const firstTasks = await payload.find({
      collection: 'tasks',
      overrideAccess: true,
      depth: 0,
      limit: 10,
      pagination: false,
      where: { automationKey: { equals: taskKey } } as never,
    })
    expect(firstTasks.totalDocs).toBe(1)
    created.tasks.push(...firstTasks.docs.map((task) => task.id))

    const secondJob = await payload.jobs.queue({
      task: CREATE_AFTER_SALES_TASK_JOB,
      queue: uniqueQueue,
      waitUntil: new Date(Date.now() - 1_000),
      input: {
        automationKey: taskKey,
        saleId: String(sale.id),
        title: `Follow-up idempotente ${stamp}`,
        type: 'satisfaction',
        dueAt: new Date().toISOString(),
        priority: 'normal',
      },
    } as never)
    created.jobs.push(secondJob.id)
    await payload.jobs.runByID({ id: secondJob.id })

    const tasks = await payload.find({
      collection: 'tasks',
      overrideAccess: true,
      depth: 0,
      limit: 10,
      pagination: false,
      where: { automationKey: { equals: taskKey } } as never,
    })
    expect(tasks.totalDocs).toBe(1)
    expect(tasks.docs[0]?.type).toBe('satisfaction')
    expect(tasks.docs[0]?.relatedTo?.some((item) => item.relationTo === 'after-sales')).toBe(true)
  }, 90_000)
})
