import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

async function workspaceGeometry(page: Page) {
  return page.locator('.esmera-view').first().evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      x: Math.round(rect.x),
      width: Math.round(rect.width),
      scrollWidth: document.documentElement.scrollWidth,
      scrollX: window.scrollX,
    }
  })
}

function expectSameGeometry(a: { x: number; width: number; scrollWidth: number; scrollX: number }, b: typeof a) {
  expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1)
  expect(b.scrollWidth).toBeLessThanOrEqual(a.scrollWidth + 1)
  expect(b.scrollX).toBe(a.scrollX)
}

function blockingViolations(result: { violations: Array<{ impact?: string | null }> }) {
  return result.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
}

async function railPeekHasNoReflow(page: Page, width: number) {
  await page.setViewportSize({ width, height: 800 })
  await page.goto('http://localhost:3000/admin')

  const nav = page.getByTestId('esmera-nav')
  await expect(nav).toBeVisible()
  const navBoxBefore = await nav.evaluate((element) => Math.round(element.getBoundingClientRect().width))
  expect(navBoxBefore).toBeLessThanOrEqual(72)

  const before = await workspaceGeometry(page)

  const link = nav.getByRole('link', { name: 'Produtos' })
  await link.hover()
  await expect(nav).toHaveAttribute('data-peek', 'open')
  await expect(link.locator('span')).toBeVisible()
  await page.waitForTimeout(300)

  const during = await workspaceGeometry(page)
  expectSameGeometry(before, during)

  await page.getByTestId('esmera-app-header').hover()
  await expect(nav).toHaveAttribute('data-peek', 'closed')
  await page.waitForTimeout(300)

  const after = await workspaceGeometry(page)
  expectSameGeometry(before, after)
}

test.describe('PR-11 — Shell: geometria e navegação', () => {
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

  test('1280px: sidebar fixa de ~260px e o peek não é ativado', async () => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('http://localhost:3000/admin')
    const nav = page.getByTestId('esmera-nav')
    const width = await nav.evaluate((element) => Math.round(element.getBoundingClientRect().width))
    expect(width).toBeGreaterThanOrEqual(250)
    expect(width).toBeLessThanOrEqual(270)

    await nav.getByRole('link', { name: 'Produtos' }).hover()
    await page.waitForTimeout(200)
    await expect(nav).toHaveAttribute('data-peek', 'closed')
  })

  test('1024px: peek expande até 260px sem reflow do workspace', async () => {
    await railPeekHasNoReflow(page, 1024)
  })

  test('1180px: peek expande até 260px sem reflow do workspace', async () => {
    await railPeekHasNoReflow(page, 1180)
  })

  test('1279px: peek expande até 260px sem reflow do workspace', async () => {
    await railPeekHasNoReflow(page, 1279)
  })

  test('teclado: Tab abre o peek, Escape fecha sem perder o foco, Tab continua', async () => {
    await page.setViewportSize({ width: 1180, height: 800 })
    await page.goto('http://localhost:3000/admin')
    const nav = page.getByTestId('esmera-nav')
    // Dois links casam com o nome acessível "Dashboard" por substring: a marca
    // ("Esméra CMS — Dashboard") e o item de navegação. Locator exato, sem
    // tocar na UI.
    const dashboardLink = nav.getByRole('link', { name: 'Dashboard', exact: true })

    await dashboardLink.focus()
    await expect(nav).toHaveAttribute('data-peek', 'open')
    await expect(dashboardLink).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(nav).toHaveAttribute('data-peek', 'closed')
    await expect(dashboardLink).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(nav.getByRole('link', { name: 'Produtos' })).toBeFocused()
  })

  test('1023px: usa o drawer móvel e não reflui o workspace', async () => {
    await page.setViewportSize({ width: 1023, height: 800 })
    await page.goto('http://localhost:3000/admin')
    await expect(page.getByTestId('esmera-nav')).toBeHidden()
    const trigger = page.getByRole('button', { name: 'Abrir navegação' })
    await expect(trigger).toBeVisible()

    const before = await workspaceGeometry(page)
    await trigger.click()
    await expect(page.getByTestId('esmera-mobile-nav')).toBeVisible()
    const during = await workspaceGeometry(page)
    expect(Math.abs(during.x - before.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(during.width - before.width)).toBeLessThanOrEqual(1)

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('esmera-mobile-nav')).toBeHidden()
  })

  test('768px: drawer lateral, Escape fecha e devolve o foco ao trigger', async () => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('http://localhost:3000/admin')
    const trigger = page.getByRole('button', { name: 'Abrir navegação' })
    await trigger.click()
    const dialog = page.getByTestId('esmera-mobile-nav')
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box?.width).toBeLessThan(768)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('390×844: drawer ocupa a viewport útil, sem overflow horizontal', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('http://localhost:3000/admin')
    const trigger = page.getByRole('button', { name: 'Abrir navegação' })
    await trigger.click()
    const dialog = page.getByTestId('esmera-mobile-nav')
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box?.width).toBeGreaterThanOrEqual(380)
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    await expect(page.getByRole('button', { name: 'Buscar no CMS' })).toBeVisible()
    await expect(page.getByTestId('esmera-global-create')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Abrir conta' })).toBeVisible()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
})

test.describe('PR-11 — Shell: Axe específico', () => {
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

  test('rail recolhido e rail expandido não introduzem violações sérias/críticas', async () => {
    await page.setViewportSize({ width: 1180, height: 800 })
    await page.goto('http://localhost:3000/admin')

    const collapsed = await new AxeBuilder({ page }).include('.esmera-nav').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(blockingViolations(collapsed)).toEqual([])

    await page.getByTestId('esmera-nav').getByRole('link', { name: 'Produtos' }).hover()
    await page.waitForTimeout(200)
    const expanded = await new AxeBuilder({ page }).include('.esmera-nav').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(blockingViolations(expanded)).toEqual([])
  })

  test('command palette aberta não introduz violações sérias/críticas', async () => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('http://localhost:3000/admin')
    await page.getByRole('button', { name: 'Buscar no CMS' }).click()
    await expect(page.getByTestId('esmera-command-palette')).toBeVisible()

    const result = await new AxeBuilder({ page }).include('.esmera-command').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(blockingViolations(result)).toEqual([])

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('esmera-command-palette')).toBeHidden()
  })

  test('create menu aberto não introduz violações sérias/críticas', async () => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('http://localhost:3000/admin')
    await page.getByTestId('esmera-global-create').click()
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()

    const result = await new AxeBuilder({ page }).include('[role="menu"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(blockingViolations(result)).toEqual([])

    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
  })

  test('mobile nav aberta não introduz violações sérias/críticas', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('http://localhost:3000/admin')
    await page.getByRole('button', { name: 'Abrir navegação' }).click()
    await expect(page.getByTestId('esmera-mobile-nav')).toBeVisible()

    const result = await new AxeBuilder({ page }).include('.esmera-mobile-nav').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(blockingViolations(result)).toEqual([])

    await page.keyboard.press('Escape')
  })
})
