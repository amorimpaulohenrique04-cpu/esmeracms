import { expect, test } from '@playwright/test'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

test.describe('Stage 20 category ordering', () => {
  test.beforeAll(async () => {
    await seedTestUser()
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test('reorders categories by drag and by the accessible position selector', async ({ page }) => {
    await login({ page, user: testUser })
    const stamp = Date.now()
    const firstTitle = `Arraste A ${stamp}`
    const secondTitle = `Arraste B ${stamp}`

    const createCategory = async (title: string, order: number) => {
      const response = await page.request.post('http://localhost:3000/api/categories?draft=true', {
        data: {
          title,
          slug: title.toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, '-'),
          status: 'active',
          order,
          _status: 'draft',
        },
      })
      expect(response.ok(), `${title} should be created`).toBeTruthy()
      const body = await response.json() as { id?: string | number; doc?: { id?: string | number } }
      return body.id ?? body.doc?.id
    }

    const firstId = await createCategory(firstTitle, 10)
    const secondId = await createCategory(secondTitle, 20)
    expect(firstId).toBeTruthy()
    expect(secondId).toBeTruthy()

    await page.goto('http://localhost:3000/admin/categories?status=active')
    const firstHandle = page.getByRole('button', { name: `Reordenar ${firstTitle}` })
    const secondHandle = page.getByRole('button', { name: `Reordenar ${secondTitle}` })
    await expect(firstHandle).toBeVisible()
    await expect(secondHandle).toBeVisible()

    const firstBox = await firstHandle.boundingBox()
    const secondBox = await secondHandle.boundingBox()
    expect(firstBox).toBeTruthy()
    expect(secondBox).toBeTruthy()

    await page.mouse.move((firstBox?.x || 0) + (firstBox?.width || 0) / 2, (firstBox?.y || 0) + (firstBox?.height || 0) / 2)
    await page.mouse.down()
    await page.mouse.move((secondBox?.x || 0) + (secondBox?.width || 0) / 2, (secondBox?.y || 0) + (secondBox?.height || 0) + 12, { steps: 12 })
    await page.mouse.up()
    await expect(page.getByText('Ordem editorial salva.')).toBeVisible({ timeout: 10_000 })

    const firstPosition = page.getByLabel(`Mover ${firstTitle} para posição`)
    await firstPosition.selectOption('1')
    await expect(page.getByText('Ordem editorial salva.')).toBeVisible({ timeout: 10_000 })

    for (const id of [firstId, secondId]) {
      if (!id) continue
      const remove = await page.request.delete(`http://localhost:3000/api/categories/${id}`)
      expect([200, 202, 204]).toContain(remove.status())
    }
  })
})
