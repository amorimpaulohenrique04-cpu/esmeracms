import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'

import { admins, canManageBusiness, canManageSite, roleOf } from '@/access/roles'
import { getProductReadiness, getVariantIssues } from '@/businessRules/products/readiness'
import { calculateSaleFinancials } from '@/businessRules/sales/financials'
import { createdUserRole } from '@/hooks/users/ensureUserRole'
import config from '@/payload.config'
import type { Customer, Product, Sale, User } from '@/payload-types'

let payload: Payload
let adminUser: User
let editorUser: User
let commercialUser: User
let primaryCustomer: Customer
let fixedProduct: Product
let snapshotSale: Sale
const createdUserIDs: User['id'][] = []

const stamp = Date.now().toString(36)

async function createUser(role: 'admin' | 'editor' | 'commercial') {
  const user = await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: {
      email: `ci-${role}-${stamp}@esmera.test`,
      password: 'test-password-123',
      name: `CI ${role}`,
      role,
    },
  })

  createdUserIDs.push(user.id)
  return user
}

describe('Esméra access and data contract', () => {
  beforeAll(
    async () => {
      payload = await getPayload({ config: await config })
      adminUser = await createUser('admin')
      editorUser = await createUser('editor')
      commercialUser = await createUser('commercial')
    },
    180_000,
  )

  afterAll(async () => {
    if (!payload) return
    const deletes: Array<['after-sales' | 'tasks' | 'sales' | 'leads' | 'customers' | 'products' | 'categories' | 'media', Record<string, unknown>]> = [
      ['after-sales', { 'sale.number': { contains: stamp } }],
      ['tasks', { title: { contains: stamp } }],
      ['sales', { number: { contains: stamp } }],
      ['leads', { name: { contains: stamp } }],
      ['customers', { name: { contains: stamp } }],
      ['products', { slug: { contains: stamp } }],
      ['categories', { slug: { contains: stamp } }],
      ['media', { filename: { contains: stamp } }],
    ]
    for (const [collection, where] of deletes) {
      await payload.delete({ collection, overrideAccess: true, where: where as never })
    }
    for (const id of createdUserIDs.reverse()) {
      await payload.delete({ collection: 'users', id, overrideAccess: true })
    }
  }, 60_000)

  it('uses explicit roles and never promotes a missing role to admin', async () => {
    expect(createdUserRole(0, 'commercial')).toBe('admin')
    expect(createdUserRole(3, null)).toBe('editor')
    expect(roleOf({ id: 10 })).toBeNull()
    expect(canManageSite({ id: 10 })).toBe(false)
    expect(canManageBusiness({ id: 10 })).toBe(false)
    expect(admins({ req: { user: commercialUser } } as never)).toBe(false)
    expect(admins({ req: { user: adminUser } } as never)).toBe(true)

    const explicitDefault = await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        email: `ci-default-${stamp}@esmera.test`,
        password: 'test-password-123',
      } as never,
    })
    createdUserIDs.push(explicitDefault.id)
    expect(explicitDefault.role).toBe('editor')
  })

  it('keeps Business private from unauthenticated and editorial users', async () => {
    await payload.create({
      collection: 'leads',
      overrideAccess: true,
      data: {
        name: `Lead privado ${stamp}`,
        email: `lead-${stamp}@example.com`,
        source: 'site',
        stage: 'new',
      },
    })

    await expect(
      payload.find({
        collection: 'leads',
        overrideAccess: false,
        user: undefined,
        where: { name: { equals: `Lead privado ${stamp}` } },
      }),
    ).rejects.toThrow()

    await expect(
      payload.find({
        collection: 'leads',
        overrideAccess: false,
        user: editorUser,
        where: { name: { equals: `Lead privado ${stamp}` } },
      }),
    ).rejects.toThrow()

    const commercialResult = await payload.find({
      collection: 'leads',
      overrideAccess: false,
      user: commercialUser,
      where: { name: { equals: `Lead privado ${stamp}` } },
    })

    expect(commercialResult.totalDocs).toBe(1)
  })

  it('exposes only active and published categories publicly', async () => {
    await payload.create({
      collection: 'categories',
      overrideAccess: true,
      data: {
        title: `Ativa ${stamp}`,
        slug: `ativa-${stamp}`,
        status: 'active',
        _status: 'published',
      },
    })

    await payload.create({
      collection: 'categories',
      overrideAccess: true,
      data: {
        title: `Arquivada ${stamp}`,
        slug: `arquivada-${stamp}`,
        status: 'archive',
        _status: 'published',
      },
    })

    await payload.create({
      collection: 'categories',
      overrideAccess: true,
      draft: true,
      data: {
        title: `Rascunho ${stamp}`,
        slug: `rascunho-${stamp}`,
        status: 'active',
        _status: 'draft',
      },
    })

    const publicResult = await payload.find({
      collection: 'categories',
      overrideAccess: false,
      user: undefined,
      where: { slug: { contains: stamp } },
    })

    const commercialResult = await payload.find({
      collection: 'categories',
      overrideAccess: false,
      user: commercialUser,
      where: { slug: { contains: stamp } },
    })

    const editorResult = await payload.find({
      collection: 'categories',
      overrideAccess: false,
      user: editorUser,
      draft: true,
      where: { slug: { contains: stamp } },
    })

    expect(publicResult.docs.map((doc) => doc.slug)).toEqual([`ativa-${stamp}`])
    expect(commercialResult.docs.map((doc) => doc.slug).sort()).toEqual([
      `arquivada-${stamp}`,
      `ativa-${stamp}`,
    ].sort())
    expect(editorResult.totalDocs).toBe(3)
  })

  it('centralizes product readiness and rejects inconsistent variants', () => {
    const ready = getProductReadiness({
      title: 'Mesa Atlas',
      slug: 'mesa-atlas',
      code: 'MES-001',
      catalogStatus: 'active',
      availability: 'available',
      categories: [1],
      gallery: [{ image: 1, mediaKey: 'capa', role: 'cover', alt: 'Mesa Atlas em madeira' }],
      priceMode: 'fixed',
      basePriceCents: 150000,
    })
    expect(ready).toEqual({ ready: true, issues: [] })

    const variantIssues = getVariantIssues({
      priceMode: 'fixed',
      optionDefinitions: [{ code: 'cor', values: [{ value: 'verde' }] }],
      variants: [
        { sku: 'SKU-1', status: 'enabled', priceMode: 'inherit', selection: [{ option: 'cor', value: 'verde' }] },
        { sku: 'SKU-1', status: 'enabled', priceMode: 'inherit', selection: [{ option: 'cor', value: 'azul' }] },
      ],
    })
    expect(variantIssues.some((issue) => issue.includes('repetido'))).toBe(true)
    expect(variantIssues.some((issue) => issue.includes('inexistente'))).toBe(true)
  })

  it('persists readiness and enforces globally unique variant SKUs', async () => {
    fixedProduct = await payload.create({
      collection: 'products',
      overrideAccess: true,
      draft: true,
      data: {
        title: `Produto snapshot ${stamp}`,
        slug: `produto-snapshot-${stamp}`,
        code: `FIX-${stamp}`.toUpperCase(),
        catalogStatus: 'active',
        availability: 'available',
        priceMode: 'fixed',
        basePriceCents: 10_000,
        optionDefinitions: [{ code: 'cor', label: 'Cor', values: [{ value: 'verde', label: 'Verde' }] }],
        variants: [{
          sku: `SKU-${stamp}`.toUpperCase(),
          selection: [{ option: 'cor', value: 'verde' }],
          priceMode: 'fixed',
          priceCents: 12_000,
          status: 'enabled',
        }],
      },
    })
    expect(fixedProduct.publicationReady).toBe(false)
    expect(fixedProduct.publicationIssues?.length).toBeGreaterThan(0)

    await expect(payload.create({
      collection: 'products',
      overrideAccess: true,
      draft: true,
      data: {
        title: `Produto SKU duplicado ${stamp}`,
        slug: `produto-sku-duplicado-${stamp}`,
        code: `DUP-${stamp}`.toUpperCase(),
        catalogStatus: 'active',
        availability: 'available',
        priceMode: 'inquiry',
        optionDefinitions: [{ code: 'cor', label: 'Cor', values: [{ value: 'verde', label: 'Verde' }] }],
        variants: [{
          sku: `SKU-${stamp}`.toUpperCase(),
          selection: [{ option: 'cor', value: 'verde' }],
          priceMode: 'inquiry',
          status: 'enabled',
        }],
      },
    })).rejects.toThrow()
  })

  it('blocks incomplete publication and exposes only ready active products publicly', async () => {
    await expect(payload.create({
      collection: 'products',
      overrideAccess: true,
      data: {
        title: `Publicação inválida ${stamp}`,
        slug: `publicacao-invalida-${stamp}`,
        code: `INV-${stamp}`.toUpperCase(),
        catalogStatus: 'active',
        availability: 'available',
        priceMode: 'inquiry',
        _status: 'published',
      },
    })).rejects.toThrow()

    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
    const media = await payload.create({
      collection: 'media',
      overrideAccess: true,
      data: { alt: `Imagem de teste ${stamp}` },
      file: { data: png, mimetype: 'image/png', name: `p0-${stamp}.png`, size: png.length },
    })
    const category = await payload.create({
      collection: 'categories',
      overrideAccess: true,
      data: {
        title: `Categoria produto ${stamp}`,
        slug: `categoria-produto-${stamp}`,
        status: 'active',
        _status: 'published',
      },
    })
    const product = await payload.create({
      collection: 'products',
      overrideAccess: true,
      data: {
        title: `Produto público ${stamp}`,
        slug: `produto-publico-${stamp}`,
        code: `PUB-${stamp}`.toUpperCase(),
        catalogStatus: 'active',
        availability: 'available',
        categories: [category.id],
        gallery: [{ image: media.id, mediaKey: 'capa', role: 'cover', alt: `Produto público ${stamp}` }],
        priceMode: 'fixed',
        basePriceCents: 25_000,
        _status: 'published',
      },
    })
    expect(product.publicationReady).toBe(true)

    const publicResult = await payload.find({
      collection: 'products',
      overrideAccess: false,
      user: undefined,
      where: { slug: { equals: product.slug } },
    })
    expect(publicResult.totalDocs).toBe(1)

    await payload.update({
      collection: 'products',
      id: product.id,
      overrideAccess: true,
      data: { catalogStatus: 'archived', _status: 'published' },
    })
    const archivedPublicResult = await payload.find({
      collection: 'products',
      overrideAccess: false,
      user: undefined,
      where: { slug: { equals: product.slug } },
    })
    expect(archivedPublicResult.totalDocs).toBe(0)
  }, 45_000)

  it('calculates sales without inventing a value for inquiry items', () => {
    expect(calculateSaleFinancials({
      items: [{ priceMode: 'fixed', unitPriceCents: 10_000, quantity: 2 }],
      discountCents: 1_000,
      shippingCents: 500,
    })).toEqual({ subtotalCents: 20_000, totalCents: 19_500, issues: [] })

    expect(calculateSaleFinancials({
      items: [{ priceMode: 'inquiry', unitPriceCents: null, quantity: 1 }],
    }).totalCents).toBeNull()
    expect(calculateSaleFinancials({
      items: [{ priceMode: 'fixed', unitPriceCents: 100, quantity: 1 }],
      discountCents: 200,
    }).issues).toContain('O desconto não pode gerar total negativo.')
  })

  it('creates immutable sale snapshots, computes totals and preserves confirmedAt', async () => {
    primaryCustomer = await payload.create({
      collection: 'customers',
      overrideAccess: true,
      data: { name: `Cliente principal ${stamp}`, email: `customer-${stamp}@example.com` },
    })

    snapshotSale = await payload.create({
      collection: 'sales',
      overrideAccess: true,
      data: {
        number: `SALE-${stamp}`.toUpperCase(),
        customer: primaryCustomer.id,
        owner: commercialUser.id,
        channel: 'site',
        status: 'confirmed',
        items: [{ product: fixedProduct.id, variantSku: `SKU-${stamp}`.toUpperCase(), quantity: 2 }],
        discountCents: 1_000,
        shippingCents: 500,
      } as never,
    })

    expect(snapshotSale.items[0].snapshotTitle).toBe(`Produto snapshot ${stamp}`)
    expect(snapshotSale.items[0].snapshotSku).toBe(`SKU-${stamp}`.toUpperCase())
    expect(snapshotSale.items[0].unitPriceCents).toBe(12_000)
    expect(snapshotSale.subtotalCents).toBe(24_000)
    expect(snapshotSale.totalCents).toBe(23_500)
    expect(snapshotSale.confirmedAt).toBeTruthy()

    await payload.update({
      collection: 'products',
      id: fixedProduct.id,
      overrideAccess: true,
      draft: true,
      data: { title: `Produto alterado ${stamp}`, variants: [{
        sku: `SKU-${stamp}`.toUpperCase(),
        selection: [{ option: 'cor', value: 'verde' }],
        priceMode: 'fixed',
        priceCents: 99_000,
        status: 'enabled',
      }] },
    })

    const afterProductChange = await payload.update({
      collection: 'sales',
      id: snapshotSale.id,
      overrideAccess: true,
      data: { status: 'production' },
    })
    expect(afterProductChange.items[0].snapshotTitle).toBe(`Produto snapshot ${stamp}`)
    expect(afterProductChange.items[0].unitPriceCents).toBe(12_000)
    expect(afterProductChange.totalCents).toBe(23_500)
    expect(afterProductChange.confirmedAt).toBe(snapshotSale.confirmedAt)

    const cancelled = await payload.update({
      collection: 'sales',
      id: snapshotSale.id,
      overrideAccess: true,
      data: { status: 'cancelled' },
    })
    expect(cancelled.confirmedAt).toBe(snapshotSale.confirmedAt)
  })

  it('keeps legacy Lead commercial fields inert', async () => {
    const legacyLead = await payload.create({
      collection: 'leads',
      overrideAccess: true,
      data: {
        name: `Lead legado inerte ${stamp}`,
        email: `legacy-inert-${stamp}@example.com`,
        source: 'site',
        stage: 'won',
        owner: commercialUser.id,
      },
    })

    expect(legacyLead.stage).toBe('won')
    expect(legacyLead.customer).toBeNull()
    expect(legacyLead.closedAt).toBeNull()

    const changedLegacyStage = await payload.update({
      collection: 'leads',
      id: legacyLead.id,
      overrideAccess: true,
      data: { stage: 'lost' },
    })
    expect(changedLegacyStage.stage).toBe('lost')
    expect(changedLegacyStage.closedAt).toBeNull()
  })

  it('sets task completion dates and clears them when reopened', async () => {
    const task = await payload.create({
      collection: 'tasks',
      overrideAccess: true,
      data: {
        title: `Tarefa ${stamp}`,
        status: 'pending',
        priority: 'normal',
        dueAt: new Date(Date.now() + 86_400_000).toISOString(),
        assignee: commercialUser.id,
      },
    })
    const done = await payload.update({ collection: 'tasks', id: task.id, overrideAccess: true, data: { status: 'done' } })
    expect(done.completedAt).toBeTruthy()
    const reopened = await payload.update({ collection: 'tasks', id: task.id, overrideAccess: true, data: { status: 'in_progress' } })
    expect(reopened.completedAt).toBeNull()
  })

  it('derives the after-sales customer from the sale without nested follow-up behavior', async () => {
    const otherCustomer = await payload.create({
      collection: 'customers',
      overrideAccess: true,
      data: { name: `Cliente divergente ${stamp}`, email: `other-${stamp}@example.com` },
    })

    await expect(payload.create({
      collection: 'after-sales',
      overrideAccess: true,
      data: {
        sale: snapshotSale.id,
        customer: otherCustomer.id,
        status: 'open',
        priority: 'normal',
      },
    })).rejects.toThrow()

    await expect(payload.create({
      collection: 'after-sales',
      overrideAccess: true,
      data: {
        sale: snapshotSale.id,
        customer: primaryCustomer.id,
        status: 'open',
        priority: 'normal',
        incidentType: 'damage',
      },
    })).rejects.toThrow()

    const afterSale = await payload.create({
      collection: 'after-sales',
      overrideAccess: true,
      data: {
        sale: snapshotSale.id,
        customer: primaryCustomer.id,
        owner: commercialUser.id,
        status: 'following',
        priority: 'normal',
      },
    })
    expect(typeof afterSale.customer === 'object' ? afterSale.customer.id : afterSale.customer).toBe(primaryCustomer.id)
    expect(afterSale.followUps).toEqual([])
  })

  it('enforces editorial and commercial boundaries on APIs and globals', async () => {
    await expect(payload.create({
      collection: 'categories',
      overrideAccess: false,
      user: commercialUser,
      data: { title: `Bloqueada ${stamp}`, slug: `bloqueada-${stamp}`, status: 'active' },
    })).rejects.toThrow()

    await expect(payload.create({
      collection: 'leads',
      overrideAccess: false,
      user: editorUser,
      data: { name: `Bloqueado ${stamp}`, email: `blocked-${stamp}@example.com`, source: 'site', stage: 'new' },
    })).rejects.toThrow()

    await expect(payload.updateGlobal({
      slug: 'site-settings',
      overrideAccess: false,
      user: commercialUser,
      data: { siteName: 'Não permitido' },
    })).rejects.toThrow()
  })
})
