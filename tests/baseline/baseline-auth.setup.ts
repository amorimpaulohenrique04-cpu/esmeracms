import fs from 'node:fs/promises'
import path from 'node:path'

import { expect, test as setup } from '@playwright/test'

import { VISUAL_FIXED_TIME } from '../../src/visual-baseline/contract'
import { baselineAuthFile } from './fixtures'

const email = process.env.BASELINE_ADMIN_EMAIL || 'baseline.admin@esmera.local'
const password = process.env.BASELINE_ADMIN_PASSWORD || 'EsmeraBaseline-2026!'

type BaselineTokenPayload = {
  collection?: string
  email?: string
  role?: string
}

function decodeTokenPayload(token: string): BaselineTokenPayload {
  const encoded = token.split('.')[1]
  if (!encoded) throw new Error('O cookie de autenticação não contém um JWT válido.')
  return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as BaselineTokenPayload
}

setup('authenticate deterministic baseline administrator', async ({ page }) => {
  await page.clock.setFixedTime(new Date(VISUAL_FIXED_TIME))
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
  await page.fill('#field-email', email)
  await page.fill('#field-password', password)

  await Promise.all([
    page.waitForURL((url) => url.pathname === '/admin', { timeout: 20_000 }),
    page.click('button[type="submit"]'),
  ])

  await expect(page.getByTestId('esmera-nav')).toBeVisible({ timeout: 15_000 })

  const cookies = await page.context().cookies()
  const authCookie = cookies.find((cookie) => cookie.name === 'payload-token')
  expect(authCookie, 'O login não gravou o cookie payload-token.').toBeTruthy()

  const tokenPayload = decodeTokenPayload(authCookie?.value || '')
  expect(tokenPayload.collection).toBe('users')
  expect(tokenPayload.email).toBe(email)
  expect(tokenPayload.role).toBe('admin')

  await fs.mkdir(path.dirname(baselineAuthFile), { recursive: true })
  await page.context().storageState({ path: baselineAuthFile })
})
