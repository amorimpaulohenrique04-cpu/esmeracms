import { expect, test } from '@playwright/test'

import { fetchProductUpdatedAt } from '../helpers/createDraftEntities'
import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2p9sAAAAASUVORK5CYII=', 'base64')

test.describe('Stage 20 product publication', () => {
  test.beforeAll(async () => {
    await seedTestUser()
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test('creates a draft, completes readiness, publishes and finds the product', async ({ page, request }) => {
    test.setTimeout(120_000)
    await login({ page, user: testUser })
    const stamp = Date.now()
    const title = `Produto Publicável ${stamp}`

    const categoryResponse = await page.request.post('http://localhost:3000/api/categories?draft=true', {
      data: {
        title: `Categoria Publicável ${stamp}`,
        slug: `categoria-publicavel-${stamp}`,
        status: 'active',
        order: 10,
        _status: 'draft',
      },
    })
    expect(categoryResponse.ok(), await categoryResponse.text()).toBeTruthy()
    const categoryBody = await categoryResponse.json() as { id?: string | number; doc?: { id?: string | number } }
    const categoryId = categoryBody.id ?? categoryBody.doc?.id
    expect(categoryId).toBeTruthy()

    const publishCategory = await page.request.post('http://localhost:3000/api/admin-categories', {
      data: { action: 'publish', id: categoryId },
    })
    expect(publishCategory.ok(), await publishCategory.text()).toBeTruthy()

    const mediaResponse = await page.request.post('http://localhost:3000/api/media', {
      multipart: {
        _payload: JSON.stringify({ alt: 'Objeto Esméra sobre fundo neutro', _status: 'published' }),
        file: {
          name: `produto-publicavel-${stamp}.png`,
          mimeType: 'image/png',
          buffer: pixel,
        },
      },
    })
    expect(mediaResponse.ok(), `media upload failed: ${mediaResponse.status()} ${await mediaResponse.text()}`).toBeTruthy()
    const mediaBody = await mediaResponse.json() as { id?: string | number; url?: string; _status?: string; doc?: { id?: string | number; url?: string; _status?: string } }
    const mediaId = mediaBody.id ?? mediaBody.doc?.id
    const mediaURL = mediaBody.url ?? mediaBody.doc?.url
    const mediaStatus = mediaBody._status ?? mediaBody.doc?._status
    expect(mediaId).toBeTruthy()
    expect(mediaStatus).toBe('published')
    expect(mediaURL).toMatch(/^http:\/\/localhost:3000\/api\/media\/file\//)

    const publicMediaDocument = await request.get(`http://localhost:3000/api/media/${mediaId}`)
    expect(publicMediaDocument.ok(), await publicMediaDocument.text()).toBeTruthy()
    const publicMediaFile = await request.get(mediaURL as string)
    expect(publicMediaFile.ok()).toBeTruthy()

    const productResponse = await page.request.post('http://localhost:3000/api/products?draft=true', {
      data: {
        title,
        slug: `produto-publicavel-${stamp}`,
        code: `PUB-${stamp}`,
        catalogStatus: 'active',
        availability: 'unique',
        priceMode: 'fixed',
        basePriceCents: 245_000,
        categories: [categoryId],
        gallery: [{
          image: mediaId,
          mediaKey: 'cover',
          role: 'cover',
          alt: 'Objeto Esméra sobre fundo neutro',
        }],
        _status: 'draft',
      },
    })
    expect(productResponse.ok(), await productResponse.text()).toBeTruthy()
    const productBody = await productResponse.json() as { id?: string | number; doc?: { id?: string | number } }
    const productId = productBody.id ?? productBody.doc?.id
    expect(productId).toBeTruthy()

    await page.goto(`http://localhost:3000/admin/products?product=${productId}&tab=overview`)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await expect(page.getByText('Pronto para publicar')).toBeVisible()

    // Caminho coordenado: items[] com token de concorrência por produto.
    // O caminho direto antigo (ids[]) foi removido no PR-03.
    const expectedUpdatedAt = await fetchProductUpdatedAt(page, productId as string | number)
    const publishProduct = await page.request.post('http://localhost:3000/api/admin-products', {
      data: { action: 'publish', items: [{ id: productId, expectedUpdatedAt }] },
    })
    const published = await publishProduct.json() as {
      result?: { meta?: { requested?: number; published?: number; results?: Array<{ status?: string; message?: string }> } }
    }
    expect(publishProduct.ok(), JSON.stringify(published)).toBeTruthy()
    expect(published.result?.meta?.published, JSON.stringify(published)).toBe(1)
    expect(published.result?.meta?.requested).toBe(1)
    expect(published.result?.meta?.results?.[0].status).toBe('published')

    const storedResponse = await page.request.get(`http://localhost:3000/api/products/${productId}?draft=true&depth=0`)
    expect(storedResponse.ok(), await storedResponse.text()).toBeTruthy()
    const stored = await storedResponse.json() as { _status?: string; title?: string }
    expect(stored._status).toBe('published')
    expect(stored.title).toBe(title)

    await page.goto(`http://localhost:3000/admin/products?q=${encodeURIComponent(title)}`)
    await expect(page.getByRole('link', { name: title }).first()).toBeVisible()
  })
})
