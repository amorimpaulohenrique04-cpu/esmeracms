import { expect, test } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

const baseURL = process.env.BASELINE_BASE_URL || 'http://127.0.0.1:3000'
const email = process.env.BASELINE_ADMIN_EMAIL || 'baseline.admin@esmera.local'
const password = process.env.BASELINE_ADMIN_PASSWORD || 'EsmeraBaseline-2026!'

const viewports = [
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'notebook-1280x800', width: 1280, height: 800 },
  { name: 'tablet-landscape-1024x768', width: 1024, height: 768 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'mobile-390x844', width: 390, height: 844 },
] as const

test('capture current admin visual baseline', async ({ page }) => {
  const createUser = await page.request.post(`${baseURL}/api/users`, {
    data: {
      email,
      password,
      role: 'admin',
      name: 'Baseline Admin',
    },
  })

  if (!createUser.ok() && ![400, 401, 403, 409].includes(createUser.status())) {
    throw new Error(`Unable to bootstrap baseline admin: HTTP ${createUser.status()} ${await createUser.text()}`)
  }

  const login = await page.request.post(`${baseURL}/api/users/login`, {
    data: { email, password },
  })
  expect(login.ok(), `Baseline admin login failed: HTTP ${login.status()} ${await login.text()}`).toBeTruthy()

  const stamp = Date.now()
  const createCategory = await page.request.post(`${baseURL}/api/categories?draft=true`, {
    data: {
      title: 'Objetos Baseline',
      slug: `objetos-baseline-${stamp}`,
      status: 'active',
      order: 100,
      description: 'Categoria usada para validar o workspace master-detail.',
      searchTerms: [{ term: 'objetos especiais' }, { term: 'curadoria' }],
      seo: {
        title: 'Objetos Baseline · Esméra',
        description: 'Seleção editorial de objetos Esméra para o baseline visual.',
        noIndex: false,
      },
      _status: 'draft',
    },
  })
  expect(createCategory.ok(), `Baseline category create failed: HTTP ${createCategory.status()} ${await createCategory.text()}`).toBeTruthy()
  const categoryBody = await createCategory.json() as { id?: string | number; doc?: { id?: string | number } }
  const categoryId = categoryBody.id ?? categoryBody.doc?.id
  expect(categoryId).toBeTruthy()

  const createProduct = await page.request.post(`${baseURL}/api/products?draft=true`, {
    data: {
      title: 'Objeto Baseline Esméra',
      code: `BASE-${stamp}`,
      catalogStatus: 'active',
      availability: 'unique',
      priceMode: 'fixed',
      basePriceCents: 145_000,
      material: 'Esmeralda bruta',
      edition: 'Peça única',
      categories: [categoryId],
      _status: 'draft',
    },
  })
  expect(createProduct.ok(), `Baseline product create failed: HTTP ${createProduct.status()} ${await createProduct.text()}`).toBeTruthy()
  const productBody = await createProduct.json() as { id?: string | number; doc?: { id?: string | number } }
  const productId = productBody.id ?? productBody.doc?.id
  expect(productId).toBeTruthy()

  const createCustomer = await page.request.post(`${baseURL}/api/admin-customers`, {
    data: {
      action: 'create',
      data: {
        name: 'Mariana Lopes',
        company: 'Atelier Mariana',
        phone: '(11) 99876-5432',
        email: `MARIANA.${stamp}@EXAMPLE.COM`,
        origin: 'instagram',
        status: 'follow_up',
        tags: ['colecionadora', 'interiores'],
        interestProfile: {
          categories: [categoryId],
          materials: ['esmeralda', 'pedra natural'],
          investmentMinCents: 100_000,
          investmentMaxCents: 500_000,
        },
      },
    },
  })
  expect(createCustomer.ok(), `Baseline customer create failed: HTTP ${createCustomer.status()} ${await createCustomer.text()}`).toBeTruthy()
  const customerBody = await createCustomer.json() as { id?: string | number }
  const customerId = customerBody.id
  expect(customerId).toBeTruthy()

  const createOpportunity = await page.request.post(`${baseURL}/api/opportunities`, {
    data: {
      customer: customerId,
      source: 'instagram',
      stage: 'proposal',
      priority: 'high',
      interestedProducts: [productId],
      estimatedValueCents: 145_000,
      nextAction: 'Enviar proposta revisada',
      nextActionAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      expectedCloseAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  })
  expect(createOpportunity.ok(), `Baseline opportunity create failed: HTTP ${createOpportunity.status()} ${await createOpportunity.text()}`).toBeTruthy()
  const opportunityBody = await createOpportunity.json() as { id?: string | number; doc?: { id?: string | number } }
  const opportunityId = opportunityBody.id ?? opportunityBody.doc?.id
  expect(opportunityId).toBeTruthy()

  const createSale = await page.request.post(`${baseURL}/api/sales`, {
    data: {
      number: `BASE-SALE-${stamp}`,
      customer: customerId,
      channel: 'whatsapp',
      status: 'confirmed',
      nextAction: 'Confirmar endereço de entrega',
      items: [{ product: productId, quantity: 1 }],
      discountCents: 0,
      shippingCents: 12_000,
    },
  })
  expect(createSale.ok(), `Baseline sale create failed: HTTP ${createSale.status()} ${await createSale.text()}`).toBeTruthy()
  const saleBody = await createSale.json() as { id?: string | number; doc?: { id?: string | number } }
  const saleId = saleBody.id ?? saleBody.doc?.id
  expect(saleId).toBeTruthy()

  const createAfterSale = await page.request.post(`${baseURL}/api/after-sales`, {
    data: {
      sale: saleId,
      customer: customerId,
      status: 'following',
      priority: 'normal',
      expectedDeliveryAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      incidentType: 'none',
    },
  })
  expect(createAfterSale.ok(), `Baseline after-sale create failed: HTTP ${createAfterSale.status()} ${await createAfterSale.text()}`).toBeTruthy()

  const createTask = await page.request.post(`${baseURL}/api/tasks`, {
    data: {
      title: 'Enviar seleção complementar',
      status: 'pending',
      priority: 'high',
      dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      relatedTo: [{ relationTo: 'customers', value: customerId }],
      notes: 'Próxima ação real para o baseline visual.',
    },
  })
  expect(createTask.ok(), `Baseline task create failed: HTTP ${createTask.status()} ${await createTask.text()}`).toBeTruthy()

  const addInterest = await page.request.post(`${baseURL}/api/admin-customers`, {
    data: { action: 'add-interest', id: customerId, productId, note: 'Interesse para composição de living.' },
  })
  expect(addInterest.ok(), `Baseline interest create failed: HTTP ${addInterest.status()} ${await addInterest.text()}`).toBeTruthy()

  const addNote = await page.request.post(`${baseURL}/api/admin-customers`, {
    data: { action: 'add-note', id: customerId, note: 'Cliente prefere contato no período da tarde e curadoria com peças únicas.' },
  })
  expect(addNote.ok(), `Baseline note create failed: HTTP ${addNote.status()} ${await addNote.text()}`).toBeTruthy()

  const routes = [
    { name: 'dashboard', url: '/admin' },
    { name: 'products-list', url: '/admin/products' },
    { name: 'products-grid', url: '/admin/products?view=grid' },
    { name: 'product-overview', url: `/admin/products?product=${productId}&tab=overview` },
    { name: 'product-media', url: `/admin/products?product=${productId}&tab=media` },
    { name: 'categories-list', url: '/admin/categories?status=active' },
    { name: 'category-general', url: `/admin/categories?status=active&category=${categoryId}&tab=general` },
    { name: 'category-media-seo', url: `/admin/categories?status=active&category=${categoryId}&tab=media` },
    { name: 'category-products', url: `/admin/categories?status=active&category=${categoryId}&tab=products` },
    { name: 'customers-list', url: '/admin/customers' },
    { name: 'customer-overview', url: `/admin/customers?customer=${customerId}&tab=overview` },
    { name: 'customer-history', url: `/admin/customers?customer=${customerId}&tab=history` },
    { name: 'customer-interests', url: `/admin/customers?customer=${customerId}&tab=interests` },
    { name: 'customer-sales', url: `/admin/customers?customer=${customerId}&tab=sales` },
    { name: 'customer-after-sales', url: `/admin/customers?customer=${customerId}&tab=after-sales` },
    { name: 'customer-notes', url: `/admin/customers?customer=${customerId}&tab=notes` },
    { name: 'opportunity-document', url: `/admin/collections/opportunities/${opportunityId}` },
    { name: 'sales-list', url: '/admin/sales?view=list' },
    { name: 'sales-pipeline', url: '/admin/sales?view=pipeline' },
    { name: 'after-sales', url: '/admin/after-sales' },
    { name: 'reports', url: '/admin/reports' },
    { name: 'settings', url: '/admin/settings' },
    { name: 'technical', url: '/admin/technical' },
  ] as const

  await page.emulateMedia({ reducedMotion: 'reduce' })

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const outputDir = path.join('artifacts', 'admin-baseline', viewport.name)
    await fs.mkdir(outputDir, { recursive: true })

    for (const route of routes) {
      const response = await page.goto(route.url, { waitUntil: 'domcontentloaded' })
      expect(response?.status(), `${route.url} should render successfully`).toBeLessThan(400)
      await page.evaluate(async () => {
        if ('fonts' in document) await document.fonts.ready
      })
      await page.waitForTimeout(250)
      await page.screenshot({
        path: path.join(outputDir, `${route.name}.png`),
        fullPage: true,
      })
    }
  }
})
