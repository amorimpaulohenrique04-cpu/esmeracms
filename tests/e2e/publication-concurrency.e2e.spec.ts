import type { APIResponse, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { createDraftCategory, createDraftProduct } from '../helpers/createDraftEntities'
import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

type SavedEnvelope = {
  ok: boolean
  result?: { revision?: string; meta?: { updatedAt?: string | null } }
}

type ErrorEnvelope = {
  ok: boolean
  error?: { code?: string }
}

async function saveDraft(
  page: Page,
  endpoint: 'admin-products' | 'admin-categories',
  id: string | number,
  data: Record<string, unknown>,
  expectedRevision: string | null,
  expectedUpdatedAt: string | null,
): Promise<APIResponse> {
  return page.request.post(`http://localhost:3000/api/${endpoint}`, {
    data: { action: 'save-draft', id, data, expectedRevision, expectedUpdatedAt },
  })
}

test.describe('Publication concurrency — save-draft compare-and-swap (Fase 1)', () => {
  test.beforeAll(async () => {
    await seedTestUser()
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test('product save-draft enforces optimistic concurrency and rejects a stale revision (two-tab simulation)', async ({ page }) => {
    test.setTimeout(60_000)
    await login({ page, user: testUser })
    const stamp = Date.now()
    const productId = await createDraftProduct(page, stamp)

    // Primeira gravação da sessão: ninguém ainda conhece a revisão do servidor,
    // então expectedRevision=null passa sem CAS (comportamento esperado — é a
    // mesma lacuna documentada em FLOW-02 para a primeira escrita).
    const first = await saveDraft(page, 'admin-products', productId, { title: 'Editado A' }, null, null)
    expect(first.ok(), await first.text()).toBeTruthy()
    const firstBody = await first.json() as SavedEnvelope
    const revisionA = firstBody.result?.revision
    const updatedAtA = firstBody.result?.meta?.updatedAt ?? null
    expect(revisionA).toBeTruthy()

    // Segunda gravação com a revisão correta (a que acabamos de receber) sucede
    // e avança a revisão.
    const second = await saveDraft(page, 'admin-products', productId, { title: 'Editado B' }, revisionA ?? null, updatedAtA)
    expect(second.ok(), await second.text()).toBeTruthy()
    const secondBody = await second.json() as SavedEnvelope
    const revisionB = secondBody.result?.revision
    expect(revisionB).toBeTruthy()
    expect(revisionB).not.toBe(revisionA)

    // "Aba B" ainda usando a revisão A (desatualizada) tenta salvar — deve ser
    // rejeitada com 409/revision_conflict, não sobrescrever silenciosamente.
    const conflict = await saveDraft(page, 'admin-products', productId, { title: 'Editado C (aba desatualizada)' }, revisionA ?? null, updatedAtA)
    expect(conflict.status()).toBe(409)
    const conflictBody = await conflict.json() as ErrorEnvelope
    expect(conflictBody.ok).toBe(false)
    expect(conflictBody.error?.code).toBe('revision_conflict')

    // O documento no servidor reflete a última gravação bem-sucedida (B), não a
    // tentativa em conflito (C).
    const stored = await page.request.get(`http://localhost:3000/api/products/${productId}?draft=true&depth=0`)
    expect(stored.ok(), await stored.text()).toBeTruthy()
    const storedBody = await stored.json() as { title?: string }
    expect(storedBody.title).toBe('Editado B')
  })

  test('category save-draft enforces optimistic concurrency and rejects a stale revision (two-tab simulation)', async ({ page }) => {
    test.setTimeout(60_000)
    await login({ page, user: testUser })
    const stamp = Date.now()
    const categoryId = await createDraftCategory(page, stamp)

    const first = await saveDraft(page, 'admin-categories', categoryId, { title: 'Categoria Editada A' }, null, null)
    expect(first.ok(), await first.text()).toBeTruthy()
    const firstBody = await first.json() as SavedEnvelope
    const revisionA = firstBody.result?.revision
    const updatedAtA = firstBody.result?.meta?.updatedAt ?? null
    expect(revisionA).toBeTruthy()

    const second = await saveDraft(page, 'admin-categories', categoryId, { title: 'Categoria Editada B' }, revisionA ?? null, updatedAtA)
    expect(second.ok(), await second.text()).toBeTruthy()
    const secondBody = await second.json() as SavedEnvelope
    expect(secondBody.result?.revision).toBeTruthy()
    expect(secondBody.result?.revision).not.toBe(revisionA)

    const conflict = await saveDraft(page, 'admin-categories', categoryId, { title: 'Categoria Editada C (aba desatualizada)' }, revisionA ?? null, updatedAtA)
    expect(conflict.status()).toBe(409)
    const conflictBody = await conflict.json() as ErrorEnvelope
    expect(conflictBody.ok).toBe(false)
    expect(conflictBody.error?.code).toBe('revision_conflict')

    const stored = await page.request.get(`http://localhost:3000/api/categories/${categoryId}?draft=true&depth=0`)
    expect(stored.ok(), await stored.text()).toBeTruthy()
    const storedBody = await stored.json() as { title?: string }
    expect(storedBody.title).toBe('Categoria Editada B')
  })
})
