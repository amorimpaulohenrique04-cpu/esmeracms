import fs from 'node:fs/promises'
import path from 'node:path'

import { baselineViewports } from '../../src/visual-baseline/contract'
import { expect, readBaselineFixtures, settleVisualPage, test } from './fixtures'

test('capture current admin visual baseline', async ({ page }) => {
  const fixtures = await readBaselineFixtures()
  const routes = [
    { name: 'dashboard', url: '/admin' },
    { name: 'products-list', url: '/admin/products' },
    { name: 'products-grid', url: '/admin/products?view=grid' },
    { name: 'product-overview', url: `/admin/products?product=${fixtures.productId}&tab=overview` },
    { name: 'product-media', url: `/admin/products?product=${fixtures.productId}&tab=media` },
    { name: 'categories-list', url: '/admin/categories?status=active' },
    { name: 'category-general', url: `/admin/categories?status=active&category=${fixtures.categoryId}&tab=general` },
    { name: 'category-media-seo', url: `/admin/categories?status=active&category=${fixtures.categoryId}&tab=media` },
    { name: 'category-products', url: `/admin/categories?status=active&category=${fixtures.categoryId}&tab=products` },
    { name: 'customers-list', url: '/admin/customers' },
    { name: 'customer-overview', url: `/admin/customers?customer=${fixtures.customerId}&tab=overview` },
    { name: 'customer-history', url: `/admin/customers?customer=${fixtures.customerId}&tab=history` },
    { name: 'customer-interests', url: `/admin/customers?customer=${fixtures.customerId}&tab=interests` },
    { name: 'customer-sales', url: `/admin/customers?customer=${fixtures.customerId}&tab=sales` },
    { name: 'customer-after-sales', url: `/admin/customers?customer=${fixtures.customerId}&tab=after-sales` },
    { name: 'customer-notes', url: `/admin/customers?customer=${fixtures.customerId}&tab=notes` },
    { name: 'opportunity-document', url: `/admin/collections/opportunities/${fixtures.opportunityId}` },
    { name: 'sales-list', url: '/admin/sales?view=list' },
    { name: 'sales-pipeline', url: '/admin/sales?view=pipeline' },
    { name: 'after-sales', url: '/admin/after-sales?status=all' },
    { name: 'after-sales-occurrences', url: '/admin/after-sales?focus=occurrences&status=all' },
    { name: 'reports', url: '/admin/reports' },
    { name: 'settings', url: '/admin/settings' },
    { name: 'technical', url: '/admin/technical' },
  ] as const

  for (const viewport of baselineViewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const outputDir = path.join('artifacts', 'admin-baseline', viewport.name)
    await fs.mkdir(outputDir, { recursive: true })

    for (const route of routes) {
      const response = await page.goto(route.url, { waitUntil: 'domcontentloaded' })
      expect(response?.status(), `${route.url} should render successfully`).toBeLessThan(400)
      await settleVisualPage(page)
      await page.screenshot({
        path: path.join(outputDir, `${route.name}.png`),
        fullPage: true,
      })
    }
  }
})
