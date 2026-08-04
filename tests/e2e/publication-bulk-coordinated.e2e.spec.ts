import type { APIResponse, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { createDraftProduct, fetchProductUpdatedAt } from '../helpers/createDraftEntities'
import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

type BulkItemResult = {
  id: string | number
  title?: string
  status: 'published' | 'blocked' | 'warning_requires_confirmation' | 'revision_conflict' | 'failed'
  message: string
  revision?: string
  updatedAt?: string
}

type BulkEnvelope = {
  ok?: boolean
  result?: {
    meta?: {
      requested: number
      published: number
      blocked: number
      conflicts: number
      failed: number
      results: BulkItemResult[]
    }
  }
  error?: { code?: string; summary?: string }
}

function publishBulk(page: Page, items: unknown): Promise<APIResponse> {
  return page.request.post('http://localhost:3000/api/admin-products', {
    data: { action: 'publish', items },
  })
}

function resultFor(body: BulkEnvelope, id: string | number) {
  return body.result?.meta?.results.find((item) => String(item.id) === String(id))
}

async function statusOf(page: Page, id: string | number) {
  const response = await page.request.get(`http://localhost:3000/api/products/${id}?draft=true&depth=0`)
  const document = await response.json() as { _status?: string }
  return document._status
}

/** Produto sem categoria/galeria: reprova na readiness e deve voltar `blocked`. */
async function createIncompleteProduct(page: Page, stamp: number | string) {
  const response = await page.request.post('http://localhost:3000/api/products?draft=true', {
    data: {
      title: `Produto Incompleto ${stamp}`,
      slug: `produto-incompleto-${stamp}`,
      code: `INC-${stamp}`,
      catalogStatus: 'active',
      availability: 'unique',
      priceMode: 'inquiry',
      _status: 'draft',
    },
  })
  const body = await response.json() as { id?: string | number; doc?: { id?: string | number } }
  const id = body.id ?? body.doc?.id
  expect(id).toBeTruthy()
  return id as string | number
}

test.describe('Publicação em lote coordenada (PR-03)', () => {
  test.beforeAll(async () => {
    await seedTestUser()
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test('publica todos os itens válidos do lote', async ({ page }) => {
    test.setTimeout(120_000)
    await login({ page, user: testUser })
    const stamp = Date.now()
    const [first, second] = [await createDraftProduct(page, `${stamp}-a`), await createDraftProduct(page, `${stamp}-b`)]

    const response = await publishBulk(page, [
      { id: first, expectedUpdatedAt: await fetchProductUpdatedAt(page, first) },
      { id: second, expectedUpdatedAt: await fetchProductUpdatedAt(page, second) },
    ])
    const body = await response.json() as BulkEnvelope
    expect(response.ok(), JSON.stringify(body)).toBeTruthy()
    expect(body.result?.meta?.requested).toBe(2)
    expect(body.result?.meta?.published, JSON.stringify(body)).toBe(2)
    expect(await statusOf(page, first)).toBe('published')
    expect(await statusOf(page, second)).toBe('published')
  })

  test('sucesso parcial: um item bloqueado não impede os demais e devolve updatedAt para retry', async ({ page }) => {
    test.setTimeout(120_000)
    await login({ page, user: testUser })
    const stamp = Date.now()
    const valid = await createDraftProduct(page, `${stamp}-ok`)
    const incomplete = await createIncompleteProduct(page, `${stamp}-bad`)

    const response = await publishBulk(page, [
      { id: valid, expectedUpdatedAt: await fetchProductUpdatedAt(page, valid) },
      { id: incomplete, expectedUpdatedAt: await fetchProductUpdatedAt(page, incomplete) },
    ])
    const body = await response.json() as BulkEnvelope
    expect(response.ok(), JSON.stringify(body)).toBeTruthy()
    expect(body.result?.meta?.published).toBe(1)
    expect(body.result?.meta?.blocked).toBe(1)

    expect(resultFor(body, valid)?.status).toBe('published')
    const blocked = resultFor(body, incomplete)
    expect(blocked?.status).toBe('blocked')
    expect(blocked?.message).toBeTruthy()
    // O bloqueio é lançado depois do saveDraft do coordenador: sem este
    // updatedAt novo, corrigir o produto e tentar de novo daria conflito.
    expect(blocked?.updatedAt).toBeTruthy()

    expect(await statusOf(page, valid)).toBe('published')
    expect(await statusOf(page, incomplete)).toBe('draft')
  })

  test('item sem expectedUpdatedAt falha sem chamar o coordenador e não interrompe o lote', async ({ page }) => {
    test.setTimeout(120_000)
    await login({ page, user: testUser })
    const stamp = Date.now()
    const valid = await createDraftProduct(page, `${stamp}-tok`)
    const missing = await createDraftProduct(page, `${stamp}-nok`)

    const response = await publishBulk(page, [
      { id: missing },
      { id: valid, expectedUpdatedAt: await fetchProductUpdatedAt(page, valid) },
    ])
    const body = await response.json() as BulkEnvelope
    expect(response.ok(), JSON.stringify(body)).toBeTruthy()
    expect(resultFor(body, missing)?.status).toBe('failed')
    expect(resultFor(body, valid)?.status).toBe('published')
    expect(await statusOf(page, missing)).toBe('draft')
  })

  test('id inexistente falha sem interromper os demais itens', async ({ page }) => {
    test.setTimeout(120_000)
    await login({ page, user: testUser })
    const stamp = Date.now()
    const valid = await createDraftProduct(page, `${stamp}-live`)

    const response = await publishBulk(page, [
      { id: 999_999_999, expectedUpdatedAt: '2026-01-01T00:00:00.000Z' },
      { id: valid, expectedUpdatedAt: await fetchProductUpdatedAt(page, valid) },
    ])
    const body = await response.json() as BulkEnvelope
    expect(response.ok(), JSON.stringify(body)).toBeTruthy()
    expect(resultFor(body, 999_999_999)?.status).toBe('failed')
    expect(resultFor(body, valid)?.status).toBe('published')
  })

  test('rejeita contratos inválidos sem truncar nem processar duplicados', async ({ page }) => {
    test.setTimeout(120_000)
    await login({ page, user: testUser })
    const stamp = Date.now()
    const productId = await createDraftProduct(page, `${stamp}-contract`)
    const expectedUpdatedAt = await fetchProductUpdatedAt(page, productId)

    const emptyItems = await publishBulk(page, [])
    expect(emptyItems.status()).toBe(400)

    const tooMany = await publishBulk(page, Array.from({ length: 26 }, (_, index) => ({
      id: index + 1,
      expectedUpdatedAt,
    })))
    expect(tooMany.status()).toBe(400)
    expect((await tooMany.json() as BulkEnvelope).error?.code).toBe('invalid_request')

    const duplicated = await publishBulk(page, [
      { id: productId, expectedUpdatedAt },
      { id: productId, expectedUpdatedAt },
    ])
    expect(duplicated.status()).toBe(400)

    // Formato antigo continua recusado: nada de fallback silencioso.
    const legacy = await page.request.post('http://localhost:3000/api/admin-products', {
      data: { action: 'publish', ids: [productId] },
    })
    expect(legacy.status()).toBe(400)

    // Nenhuma das requisições inválidas publicou o produto.
    expect(await statusOf(page, productId)).toBe('draft')
  })
})
