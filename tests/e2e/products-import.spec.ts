import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

import { emptyImportValues } from '../../src/businessRules/products/importValidation'

const adminEmail = process.env.E2E_ADMIN_EMAIL || process.env.PAYLOAD_ADMIN_EMAIL
const adminPassword = process.env.E2E_ADMIN_PASSWORD || process.env.PAYLOAD_ADMIN_PASSWORD

test.skip(!adminEmail || !adminPassword, 'Credenciais E2E de admin não configuradas.')

async function login(page: Page) {
  await page.goto('/admin')
  if (/\/admin\/login/.test(page.url())) {
    await page.getByLabel(/email/i).fill(adminEmail || '')
    await page.getByLabel(/senha|password/i).fill(adminPassword || '')
    await page.getByRole('button', { name: /entrar|login/i }).click()
  }
  await expect(page).toHaveURL(/\/admin(?!\/login)/)
}

function sheet(rows: number) {
  const header = [
    'nome',
    'codigo',
    'categoria',
    'preco',
    'modo_preco',
    'disponibilidade',
    'status',
    'imagens',
    'material',
    'descricao',
    'slug',
  ].join(';')
  const data = Array.from({ length: rows }, (_, index) => {
    const n = String(index + 1).padStart(4, '0')
    return [
      `Produto import ${n}`,
      `E2E-IMPORT-${n}`,
      '',
      '890,00',
      'Fixo',
      'Disponível',
      'Arquivado',
      '',
      'Cerâmica',
      `Descrição ${n}`,
      `produto-import-${n}`,
    ].join(';')
  })
  return [header, ...data].join('\n')
}

async function openImporter(page: Page) {
  await login(page)
  await page.goto('/admin/products')
  await page.getByRole('button', { name: 'Importar produtos' }).click()
  await expect(page.getByRole('heading', { name: 'Importar produtos' })).toBeVisible()
}

test.describe('importação de produtos', () => {
  test('lê o modelo de Excel pelo worker e preserva a linha original', async ({ page }) => {
    await openImporter(page)
    const response = await page.request.get('/api/admin-products-import?template=xlsx')
    expect(response.ok()).toBe(true)
    const input = page.getByRole('dialog').locator('input[type=file]')
    await expect(input).toBeEnabled()
    const worker = page.waitForEvent('worker', (candidate) => /importWorker|_next/.test(candidate.url()))
    await input.setInputFiles({
      name: 'produtos.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: await response.body(),
    })
    await worker
    await expect(page.getByRole('textbox', { name: 'nome, linha 2' })).toHaveValue('Vaso Terracota')
  })

  test('retoma uma importação salva ao reabrir a tela', async ({ page }) => {
    await login(page)
    const code = 'E2E-RESUME-' + Date.now()
    const response = await page.request.post('/api/admin-products-import', {
      data: {
        action: 'start',
        idempotencyKey: code,
        rows: [{
          rowIndex: 0,
          sourceLine: 5,
          values: { ...emptyImportValues(), title: code, code, catalogStatus: 'archived' },
          onConflict: 'skip',
        }],
      },
    })
    expect(response.status()).toBe(202)
    const { importId } = await response.json()
    try {
      await page.goto('/admin/products')
      await page.getByRole('button', { name: 'Importar produtos' }).click()
      await expect(page.getByRole('button', { name: 'Retomar importação' })).toBeVisible()
      await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click()
      await page.reload()
      await page.getByRole('button', { name: 'Importar produtos' }).click()
      await page.getByRole('button', { name: 'Retomar importação' }).click()
      await expect(page.getByText('Importação concluída.')).toBeVisible({ timeout: 30_000 })
      const result = await page.request.get('/api/admin-products-import?importId=' + importId)
      expect(await result.json()).toMatchObject({ created: 1, processedRows: 1, results: [{ sourceLine: 5 }] })
    } finally {
      await page.request.post('/api/admin-products-import', { data: { action: 'cancel', importId } })
    }
  })

  test('500 linhas mantêm o DOM do preview limitado', async ({ page }) => {
    await openImporter(page)

    const textarea = page.getByPlaceholder(/nome.*codigo.*categoria/i)
    const text = sheet(500)
    const startedAt = Date.now()
    await textarea.fill(text)
    await page.getByRole('button', { name: 'Pré-visualizar' }).click()

    await expect(page.getByText('500 linhas')).toBeVisible({ timeout: 20_000 })
    const elapsed = Date.now() - startedAt
    expect(elapsed).toBeLessThan(20_000)

    const renderedRows = page.locator('.esmera-products-import-table tbody tr')
    await expect(renderedRows).toHaveCount(40)
    await expect(page.getByText(/Mostrando 1–40 de 500/)).toBeVisible()
    await expect(page.getByText(/Sem pendências|Revalidação do catálogo necessária/)).toBeVisible()
  })

  test('arquivo com coluna extra abre o mapeamento manual', async ({ page }) => {
    await openImporter(page)

    const textarea = page.getByPlaceholder(/nome.*codigo.*categoria/i)
    await textarea.fill([
      'nome;codigo;Notas extras',
      'Vaso de teste;E2E-MAP-1;ignorar isto',
    ].join('\n'))
    await page.getByRole('button', { name: 'Pré-visualizar' }).click()

    await expect(page.getByText('Mapear colunas')).toBeVisible()
    await expect(page.getByText('Notas extras')).toBeVisible()
    const mappingRow = page.locator('.esmera-products-import__mapping-list label').filter({ hasText: 'Notas extras' })
    await expect(mappingRow.getByRole('combobox')).toHaveValue('')
  })

  test('mobile usa cartões, mantém o layout contido e não introduz violações graves de acessibilidade', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await openImporter(page)

    const textarea = page.getByPlaceholder(/nome.*codigo.*categoria/i)
    await textarea.fill(sheet(5))
    await page.getByRole('button', { name: 'Pré-visualizar' }).click()
    await expect(page.getByText('5 linhas')).toBeVisible({ timeout: 15_000 })

    await expect(page.locator('.esmera-products-import__grid')).toBeHidden()
    await expect(page.locator('.esmera-products-import__cards')).toBeVisible()
    await expect(page.locator('.esmera-products-import__cards details')).toHaveCount(5)
    await expect(page.locator('.esmera-products-import-dialog')).toHaveCSS('max-width', '375px')

    const accessibility = await new AxeBuilder({ page })
      .include('.esmera-products-import-dialog')
      .analyze()
    const seriousViolations = accessibility.violations.filter((violation) =>
      violation.impact === 'critical' || violation.impact === 'serious',
    )
    expect(seriousViolations).toEqual([])
  })
})
