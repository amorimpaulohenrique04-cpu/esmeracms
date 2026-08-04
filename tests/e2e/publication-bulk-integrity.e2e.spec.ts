import { expect, test } from '@playwright/test'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2p9sAAAAASUVORK5CYII=', 'base64')

// Estes testes documentam FLOW-01 e FLOW-05 do plano de implementação
// (docs/cms-implementation-plan.md) — bugs P0 confirmados que NÃO são corrigidos
// nesta passada (ficam para a Fase 2 e a Fase 3). Usam `test.fail()` do Playwright
// (falha ao passar, passa ao falhar): quando a fase correspondente for implementada,
// troque `test.fail(...)` por `test(...)` normal.

async function createDraftProduct(page: import('@playwright/test').Page, stamp: number) {
  const categoryResponse = await page.request.post('http://localhost:3000/api/categories?draft=true', {
    data: {
      title: `Categoria Integridade ${stamp}`,
      slug: `categoria-integridade-${stamp}`,
      status: 'active',
      order: 10,
      _status: 'draft',
    },
  })
  expect(categoryResponse.ok(), await categoryResponse.text()).toBeTruthy()
  const categoryBody = await categoryResponse.json() as { id?: string | number; doc?: { id?: string | number } }
  const categoryId = categoryBody.id ?? categoryBody.doc?.id

  await page.request.post('http://localhost:3000/api/admin-categories', { data: { action: 'publish', id: categoryId } })

  const mediaResponse = await page.request.post('http://localhost:3000/api/media', {
    multipart: {
      _payload: JSON.stringify({ alt: 'Objeto Esméra sobre fundo neutro', _status: 'published' }),
      file: { name: `integridade-${stamp}.png`, mimeType: 'image/png', buffer: pixel },
    },
  })
  const mediaBody = await mediaResponse.json() as { id?: string | number; doc?: { id?: string | number } }
  const mediaId = mediaBody.id ?? mediaBody.doc?.id

  const productResponse = await page.request.post('http://localhost:3000/api/products?draft=true', {
    data: {
      title: `Produto Integridade ${stamp}`,
      slug: `produto-integridade-${stamp}`,
      code: `INT-${stamp}`,
      catalogStatus: 'active',
      availability: 'unique',
      priceMode: 'fixed',
      basePriceCents: 199_000,
      categories: [categoryId],
      gallery: [{ image: mediaId, mediaKey: 'cover', role: 'cover', alt: 'Objeto Esméra sobre fundo neutro' }],
      _status: 'draft',
    },
  })
  const productBody = await productResponse.json() as { id?: string | number; doc?: { id?: string | number } }
  return productBody.id ?? productBody.doc?.id as string | number
}

test.describe('Publication integrity — bulk bypass and unwired verify (FLOW-01, FLOW-05)', () => {
  test.beforeAll(async () => {
    await seedTestUser()
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test.fail(
    'bulk publish rejects a per-item expectedRevision mismatch instead of ignoring it (FLOW-01, fixed in Fase 2)',
    async ({ page }) => {
      test.setTimeout(60_000)
      await login({ page, user: testUser })
      const stamp = Date.now()
      const productId = await createDraftProduct(page, stamp)

      // O contrato de bulk publish hoje nem aceita revisão esperada por item — o
      // loop em admin-products/route.ts nunca chama coordinatePublication/
      // assertExpectedDocumentRevision. Mandar uma revisão deliberadamente errada
      // deveria ser rejeitada (409/conflict) assim que a Fase 2 unificar bulk no
      // coordinator; hoje é silenciosamente ignorada e a publicação sucede.
      const publishResponse = await page.request.post('http://localhost:3000/api/admin-products', {
        data: {
          action: 'publish',
          ids: [productId],
          expectedRevisions: { [String(productId)]: 'deliberately-wrong-revision-hash' },
        },
      })
      const published = await publishResponse.json() as { updated?: number; errors?: unknown[] }
      expect(published.updated, JSON.stringify(published)).toBe(0)
    },
  )

  test.fail(
    'save-and-publish returns a verification with expected/observed revision instead of not_run (FLOW-05, fixed in Fase 3)',
    async ({ page }) => {
      test.setTimeout(60_000)
      await login({ page, user: testUser })
      const stamp = Date.now()
      const productId = await createDraftProduct(page, stamp)

      const publishResponse = await page.request.post('http://localhost:3000/api/admin-products', {
        data: { action: 'save-and-publish', id: productId },
      })
      const published = await publishResponse.json() as {
        ok?: boolean
        result?: { meta?: { verification?: { status?: string; expectedRevision?: string; observedRevision?: string } } }
      }
      const verification = published.result?.meta?.verification
      // Nenhuma rota passa `verify` ao coordinator hoje — verification sempre
      // resolve `{ status: 'not_run' }`, sem expectedRevision/observedRevision.
      expect(verification?.status, JSON.stringify(published)).not.toBe('not_run')
      expect(verification?.expectedRevision).toBeTruthy()
    },
  )
})
