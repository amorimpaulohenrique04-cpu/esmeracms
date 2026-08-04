import { expect, test } from '@playwright/test'

import { createDraftProduct } from '../helpers/createDraftEntities'
import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

// Estes testes documentam FLOW-01 e FLOW-05 do plano de implementação
// (docs/cms-implementation-plan.md) — bugs P0 confirmados que NÃO são corrigidos
// nesta passada (ficam para a Fase 2 e a Fase 3). Usam `test.fail()` do Playwright
// (falha ao passar, passa ao falhar): quando a fase correspondente for implementada,
// troque `test.fail(...)` por `test(...)` normal.

test.describe('Publication integrity — bulk bypass and unwired verify (FLOW-01, FLOW-05)', () => {
  test.beforeAll(async () => {
    await seedTestUser()
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  // FLOW-01 corrigido no PR-03: o lote passou a exigir token de concorrência
  // por item e a delegar cada publicação a coordinatePublication().
  test('bulk publish rejects a per-item concurrency token mismatch instead of ignoring it (FLOW-01)', async ({ page }) => {
    test.setTimeout(60_000)
    await login({ page, user: testUser })
    const stamp = Date.now()
    const productId = await createDraftProduct(page, stamp)

    const publishResponse = await page.request.post('http://localhost:3000/api/admin-products', {
      data: {
        action: 'publish',
        items: [{ id: productId, expectedUpdatedAt: '2020-01-01T00:00:00.000Z' }],
      },
    })
    const published = await publishResponse.json() as {
      result?: { meta?: { published?: number; conflicts?: number; results?: Array<{ status?: string }> } }
    }
    expect(publishResponse.ok(), JSON.stringify(published)).toBeTruthy()
    expect(published.result?.meta?.published, JSON.stringify(published)).toBe(0)
    expect(published.result?.meta?.conflicts).toBe(1)
    expect(published.result?.meta?.results?.[0].status).toBe('revision_conflict')

    // O documento continua rascunho: o conflito não publicou nada.
    const stored = await page.request.get(`http://localhost:3000/api/products/${productId}?draft=true&depth=0`)
    const storedBody = await stored.json() as { _status?: string }
    expect(storedBody._status).toBe('draft')
  })

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
