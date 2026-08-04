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
