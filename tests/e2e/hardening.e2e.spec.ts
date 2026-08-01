import AxeBuilder from '@axe-core/playwright'
import { expect, type BrowserContext, type Page, test } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config.js'
import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

const editorUser = { email: 'editor-hardening@esmera.test', password: 'test-editor', role: 'editor' as const }
const commercialUser = { email: 'commercial-hardening@esmera.test', password: 'test-commercial', role: 'commercial' as const }

test.describe('Stages 16–19 hardening', () => {
  let adminContext: BrowserContext
  let editorContext: BrowserContext
  let commercialContext: BrowserContext
  let adminPage: Page
  let editorPage: Page
  let commercialPage: Page
  let customerId: string | number

  test.beforeAll(async ({ browser }) => {
    await seedTestUser()
    const payload = await getPayload({ config })

    await payload.delete({ collection: 'users', overrideAccess: true, where: { email: { in: [editorUser.email, commercialUser.email] } } })
    await payload.create({ collection: 'users', overrideAccess: true, data: editorUser })
    await payload.create({ collection: 'users', overrideAccess: true, data: commercialUser })
    const customer = await payload.create({
      collection: 'customers',
      overrideAccess: true,
      data: {
        name: 'Cliente Privacidade E2E',
        email: 'privacidade-e2e@esmera.test',
        status: 'active',
        marketingConsent: false,
        privacyRequestStatus: 'none',
      },
    })
    customerId = customer.id

    adminContext = await browser.newContext()
    editorContext = await browser.newContext()
    commercialContext = await browser.newContext()
    adminPage = await adminContext.newPage()
    editorPage = await editorContext.newPage()
    commercialPage = await commercialContext.newPage()
    await login({ page: adminPage, user: testUser })
    await login({ page: editorPage, user: editorUser })
    await login({ page: commercialPage, user: commercialUser })
  })

  test.afterAll(async () => {
    await Promise.all([adminContext.close(), editorContext.close(), commercialContext.close()])
    const payload = await getPayload({ config })
    await payload.delete({ collection: 'customers', id: customerId, overrideAccess: true })
    await payload.delete({ collection: 'users', overrideAccess: true, where: { email: { in: [editorUser.email, commercialUser.email] } } })
    await cleanupTestUser()
  })

  test('operates the shell by keyboard without firing shortcuts while typing', async () => {
    await adminPage.goto('http://localhost:3000/admin/products')
    await adminPage.keyboard.press('/')
    await expect(adminPage.locator('.esmera-view input[name="q"]').first()).toBeFocused()

    await adminPage.keyboard.type('n')
    await expect(adminPage.locator('.esmera-shell-menu-popup')).toBeHidden()
    await adminPage.locator('h1').first().click()
    await adminPage.keyboard.press('n')
    await expect(adminPage.locator('.esmera-shell-menu-popup')).toBeVisible()
    await adminPage.keyboard.press('Escape')
    await expect(adminPage.locator('.esmera-shell-menu-popup')).toBeHidden()

    await adminPage.keyboard.press('Control+k')
    await expect(adminPage.getByTestId('esmera-command-palette')).toBeVisible()
    await adminPage.keyboard.press('Enter')
    await expect(adminPage).toHaveURL('http://localhost:3000/admin')
  })

  test('keeps serious and critical WCAG 2.2 AA violations out of the custom shell', async () => {
    await adminPage.goto('http://localhost:3000/admin')
    const result = await new AxeBuilder({ page: adminPage })
      .include('.esmera-app-header')
      .include('.esmera-view')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze()

    const blocking = result.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    expect(blocking).toEqual([])
  })

  test('enforces privacy access in the UI and endpoints', async () => {
    const deniedExport = await editorPage.request.get(`http://localhost:3000/api/admin-privacy?customer=${customerId}`)
    expect(deniedExport.status()).toBe(403)
    const deniedPerformance = await editorPage.request.get('http://localhost:3000/api/admin-performance')
    expect(deniedPerformance.status()).toBe(403)

    await editorPage.goto('http://localhost:3000/admin/privacy')
    await expect(editorPage.getByText('Acesso restrito')).toBeVisible()

    await commercialPage.goto(`http://localhost:3000/admin/privacy?q=${encodeURIComponent('Cliente Privacidade E2E')}`)
    await expect(commercialPage.getByRole('heading', { name: 'Privacidade' }).first()).toBeVisible()
    const row = commercialPage.getByRole('row').filter({ hasText: 'Cliente Privacidade E2E' })
    await row.getByRole('button', { name: 'Registrar consentimento' }).click()
    await expect(row.getByText('Concedido', { exact: true })).toBeVisible({ timeout: 10_000 })

    await row.getByRole('button', { name: 'Solicitar exclusão' }).click()
    await expect(row.getByText('Solicitada', { exact: true })).toBeVisible({ timeout: 10_000 })

    const exportResponse = await commercialPage.request.get(`http://localhost:3000/api/admin-privacy?customer=${customerId}`)
    expect(exportResponse.ok()).toBeTruthy()
    expect(exportResponse.headers()['content-disposition']).toContain('esmera-dados-cliente-')

    const performance = await adminPage.request.get('http://localhost:3000/api/admin-performance')
    expect(performance.ok()).toBeTruthy()
    const performanceBody = await performance.json() as { budgets?: { operationalQueryP95Ms?: number; reportingQueryP95Ms?: number } }
    expect(performanceBody.budgets).toMatchObject({ operationalQueryP95Ms: 250, reportingQueryP95Ms: 800 })
  })
})
