import fs from 'node:fs/promises'
import path from 'node:path'

import type { Page } from '@playwright/test'

import { baselineViewports } from '../../src/visual-baseline/contract'
import { expect, readBaselineFixtures, settleVisualPage, test } from './fixtures'

type OverflowBox = {
  selector: string
  left: number
  right: number
  rectWidth: number
  clientWidth: number
  scrollWidth: number
  overflowAmount: number
  overflowX: string
  boxSizing: string
  computedWidth: string
  minWidth: string
  maxWidth: string
  paddingLeft: string
  paddingRight: string
  marginLeft: string
  marginRight: string
}

type OverflowDiagnostic = {
  viewportWidth: number
  documentWidth: number
  roots: OverflowBox[]
  offenders: OverflowBox[]
}

async function expectNoDocumentOverflow(page: Page, label: string) {
  const diagnostic = await page.evaluate<OverflowDiagnostic>(() => {
    const viewportWidth = document.documentElement.clientWidth
    const documentWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body ? document.body.scrollWidth : 0,
    )
    const roots: OverflowBox[] = []
    const offenders: OverflowBox[] = []
    const rootSelectors = [
      'html',
      'body',
      '.template-default',
      '.template-default__wrap',
      '.esmera-workspace-frame',
      '.esmera-view',
      '.esmera-pipeline',
    ]

    for (const rootSelector of rootSelectors) {
      const element = document.querySelector<HTMLElement>(rootSelector)
      if (!element) continue
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      roots.push({
        selector: rootSelector,
        left: Math.round(rect.left * 100) / 100,
        right: Math.round(rect.right * 100) / 100,
        rectWidth: Math.round(rect.width * 100) / 100,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        overflowAmount: Math.max(
          0,
          element.scrollWidth - element.clientWidth,
          Math.ceil(rect.right - viewportWidth),
          Math.ceil(-rect.left),
        ),
        overflowX: style.overflowX,
        boxSizing: style.boxSizing,
        computedWidth: style.width,
        minWidth: style.minWidth,
        maxWidth: style.maxWidth,
        paddingLeft: style.paddingLeft,
        paddingRight: style.paddingRight,
        marginLeft: style.marginLeft,
        marginRight: style.marginRight,
      })
    }

    const elements = document.querySelectorAll<HTMLElement>('body *')
    for (const element of elements) {
      const rect = element.getBoundingClientRect()
      if (rect.width <= 0) continue
      const overflowAmount = Math.max(
        0,
        element.scrollWidth - element.clientWidth,
        Math.ceil(rect.right - viewportWidth),
        Math.ceil(-rect.left),
      )
      if (overflowAmount <= 1) continue

      const classes = Array.from(element.classList).slice(0, 3)
      let selector = element.tagName.toLowerCase()
      if (element.id) selector = `#${element.id}`
      else if (classes.length) selector += `.${classes.join('.')}`
      const style = getComputedStyle(element)
      const offender: OverflowBox = {
        selector,
        left: Math.round(rect.left * 100) / 100,
        right: Math.round(rect.right * 100) / 100,
        rectWidth: Math.round(rect.width * 100) / 100,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        overflowAmount,
        overflowX: style.overflowX,
        boxSizing: style.boxSizing,
        computedWidth: style.width,
        minWidth: style.minWidth,
        maxWidth: style.maxWidth,
        paddingLeft: style.paddingLeft,
        paddingRight: style.paddingRight,
        marginLeft: style.marginLeft,
        marginRight: style.marginRight,
      }

      let insertAt = offenders.length
      for (let index = 0; index < offenders.length; index += 1) {
        if (offender.overflowAmount > offenders[index].overflowAmount) {
          insertAt = index
          break
        }
      }
      offenders.splice(insertAt, 0, offender)
      if (offenders.length > 20) offenders.pop()
    }

    return { viewportWidth, documentWidth, roots, offenders }
  })

  expect(
    diagnostic.documentWidth,
    `${label} must not expand the document horizontally. ${JSON.stringify(diagnostic)}`,
  ).toBeLessThanOrEqual(diagnostic.viewportWidth + 1)
}

test('capture current admin visual baseline', async ({ page }) => {
  // Fast preflight for the only remaining document-level overflow. Keeping it
  // before the complete matrix makes future regressions fail in seconds.
  await page.setViewportSize({ width: 768, height: 1024 })
  const pipelineResponse = await page.goto('/admin/sales?view=pipeline', { waitUntil: 'domcontentloaded' })
  expect(pipelineResponse?.status(), 'tablet pipeline should render successfully').toBeLessThan(400)
  await settleVisualPage(page)
  await expectNoDocumentOverflow(page, 'tablet-768x1024/sales-pipeline-preflight')

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
