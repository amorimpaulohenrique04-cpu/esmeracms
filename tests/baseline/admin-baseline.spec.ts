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

  const createCategory = await page.request.post(`${baseURL}/api/categories?draft=true`, {
    data: {
      title: 'Objetos Baseline',
      slug: `objetos-baseline-${Date.now()}`,
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
      code: `BASE-${Date.now()}`,
      catalogStatus: 'archived',
      availability: 'unique',
      priceMode: 'inquiry',
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
    { name: 'customers', url: '/admin/customers' },
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
