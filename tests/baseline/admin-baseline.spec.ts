import fs from 'node:fs/promises'
import path from 'node:path'

import type { Page } from '@playwright/test'

import { baselineViewports } from '../../src/visual-baseline/contract'
import { expect, readBaselineFixtures, settleVisualPage, test } from './fixtures'

type OverflowOffender = {
  selector: string
  left: number
  right: number
  width: number
  overflowX: string
}

type OverflowDiagnostic = {
  viewportWidth: number
  documentWidth: number
  offenders: OverflowOffender[]
}

async function expectNoDocumentOverflow(page: Page, label: string) {
  const diagnostic = await page.evaluate<OverflowDiagnostic>(() => {
    const viewportWidth = document.documentElement.clientWidth
    const documentWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth || 0,
    )

    const selectorFor = (element: HTMLElement) => {
      if (element.id) return `#${element.id}`
      const classes = [...element.classList].slice(0, 3)
      return `${element.tagName.toLowerCase()}${classes.length ? `.${classes.join('.')}` : ''}`
    }

    const isContainedByScroller = (element: HTMLElement) => {
      let parent = element.parentElement
      while (parent && parent !== document.body) {
        const style = getComputedStyle(parent)
        const clipsInlineOverflow = ['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX)
        if (clipsInlineOverflow) {
          const rect = parent.getBoundingClientRect()
          if (rect.left >= -1 && rect.right <= viewportWidth + 1) return true
        }
        parent = parent.parentElement
      }
      return false
    }

    const offenders = [...document.querySelectorAll<HTMLElement>('body *')]
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          element,
          selector: selectorFor(element),
          left: Math.round(rect.left * 100) / 100,
          right: Math.round(rect.right * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          overflowX: getComputedStyle(element).overflowX,
        }
      })
      .filter((item) => item.width > 0 && (item.left < -1 || item.right > viewportWidth + 1))
      .filter((item) => !isContainedByScroller(item.element))
      .sort((left, right) => right.right - left.right)
      .slice(0, 12)
      .map(({ element: _element, ...item }) => item)

    return { viewportWidth, documentWidth, offenders }
  })

  expect(
    diagnostic.documentWidth,
    `${label} must not expand the document horizontally. ${JSON.stringify(diagnostic)}`,
  ).toBeLessThanOrEqual(diagnostic.viewportWidth + 1)
}

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
      await expectNoDocumentOverflow(page, `${viewport.name}/${route.name}`)
      await page.screenshot({
        path: path.join(outputDir, `${route.name}.png`),
        fullPage: true,
      })
    }
  }
})
