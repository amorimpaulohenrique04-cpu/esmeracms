import { expect, Page, test } from '@playwright/test'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

test.describe('Final operational dashboard', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    await seedTestUser()
    const context = await browser.newContext()
    page = await context.newPage()
    await login({ page, user: testUser })
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test('answers what happened, what needs attention and where to act', async () => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('http://localhost:3000/admin')

    await expect(page.getByRole('heading', { name: /^Olá,/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Produtos ativos/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Oportunidades abertas/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Vendas no mês/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Pendências/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pipeline compacto' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pendências do dia' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Catálogo recente' })).toBeVisible()
    const traffic = page.locator('.esmera-dashboard-traffic')
    await traffic.scrollIntoViewIfNeeded()
    await expect(traffic.getByRole('heading', { name: 'Tráfego' })).toBeVisible()
    await expect(traffic.getByText('Não configurado', { exact: true })).toBeVisible()
    await expect(page.getByText('15%')).toHaveCount(0)

    const newStage = page.getByRole('link', { name: /Novo: \d+ oportunidades/ })
    await expect(newStage).toHaveAttribute('href', '/admin/sales?view=list&stage=new')
    await newStage.click()
    await expect(page).toHaveURL(/\/admin\/sales\?view=list&stage=new$/)
  })

  test('keeps the final dashboard usable on tablet and mobile', async () => {
    for (const viewport of [{ width: 768, height: 1024 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport)
      await page.goto('http://localhost:3000/admin')
      await expect(page.getByRole('heading', { name: /^Olá,/ })).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(1)
    }
  })
})
