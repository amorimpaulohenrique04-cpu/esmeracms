import { expect, test, type Page } from '@playwright/test'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2p9sAAAAASUVORK5CYII=',
  'base64',
)

type ID = string | number
type MediaResponse = { id?: ID; _status?: string; filename?: string }
type GalleryResponse = { gallery?: Array<{ image?: { id?: ID; _status?: string } | ID }> }

async function createCategory(page: Page, stamp: string): Promise<ID> {
  const response = await page.request.post('/api/categories?draft=true', {
    data: {
      title: 'Categoria Popup Midia ' + stamp,
      slug: 'categoria-popup-midia-' + stamp,
      status: 'active',
      order: 10,
      _status: 'draft',
    },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  const body = await response.json() as { id?: ID; doc?: { id?: ID } }
  const id = body.id ?? body.doc?.id
  expect(id).toBeTruthy()

  const publish = await page.request.post('/api/admin-categories', {
    data: { action: 'publish', id },
  })
  expect(publish.ok(), await publish.text()).toBeTruthy()
  return id as ID
}

async function createProduct(page: Page, stamp: string, categoryId: ID): Promise<ID> {
  const response = await page.request.post('/api/admin-products', {
    data: {
      action: 'create',
      data: {
        title: 'Produto Popup Midia ' + stamp,
        availability: 'available',
        priceMode: 'inquiry',
      },
    },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  const { id } = await response.json() as { id?: ID }
  expect(id).toBeTruthy()

  const categories = await page.request.post('/api/admin-products', {
    data: { action: 'set-categories', id, categories: [categoryId] },
  })
  expect(categories.ok(), await categories.text()).toBeTruthy()
  return id as ID
}

async function attachImage(page: Page, productId: ID, mediaId: ID, expectedLength: number) {
  const append = await page.request.post('/api/admin-products', {
    data: { action: 'add-gallery-image', id: productId, mediaId },
  })
  expect(append.ok(), await append.text()).toBeTruthy()
  const gallery = await append.json() as GalleryResponse
  expect(gallery.gallery).toHaveLength(expectedLength)
}

test.describe('Regressao: imagens enviadas pelo popup devem permitir a publicacao', () => {
  test.beforeAll(async () => { await seedTestUser() })
  test.afterAll(async () => { await cleanupTestUser() })

  for (const imageCount of [1, 2]) {
    test('publica pelo fluxo do popup com ' + imageCount + ' imagem(ns)', async ({ page }) => {
      test.setTimeout(120_000)
      await login({ page, user: testUser })
      const stamp = Date.now() + '-' + imageCount
      const categoryId = await createCategory(page, stamp)
      const productId = await createProduct(page, stamp, categoryId)

      for (let index = 0; index < imageCount; index += 1) {
        const upload = await page.request.post('/api/admin-product-media', {
          multipart: {
            file: { name: 'popup-' + stamp + '-' + index + '.png', mimeType: 'image/png', buffer: pixel },
          },
        })
        expect(upload.ok(), await upload.text()).toBeTruthy()
        const media = await upload.json() as MediaResponse
        expect(media.id).toBeTruthy()
        expect(media._status).toBe('published')

        const persistedMedia = await page.request.get('/api/media/' + media.id + '?draft=false&depth=0')
        expect(persistedMedia.ok(), await persistedMedia.text()).toBeTruthy()
        expect((await persistedMedia.json() as MediaResponse)._status).toBe('published')
        await attachImage(page, productId, media.id as ID, index + 1)
      }

      const publish = await page.request.post('/api/admin-products', {
        data: {
          action: 'save-and-publish',
          id: productId,
          data: {
            title: 'Produto Popup Midia ' + stamp,
            availability: 'available',
            priceMode: 'inquiry',
            basePriceCents: null,
          },
          expectedRevision: null,
          expectedUpdatedAt: null,
        },
      })
      expect(publish.ok(), await publish.text()).toBeTruthy()
      const result = await publish.json() as { result?: { status?: string } }
      // O probe pode ficar indisponivel, mas o documento ainda deve estar publicado.
      expect(['published', 'published_but_unverified']).toContain(result.result?.status)

      const publishedProduct = await page.request.get('/api/products/' + productId + '?depth=2')
      expect(publishedProduct.ok(), await publishedProduct.text()).toBeTruthy()
      const product = await publishedProduct.json() as {
        _status?: string
        gallery?: Array<{ image?: { _status?: string } }>
      }
      expect(product._status).toBe('published')
      expect(product.gallery).toHaveLength(imageCount)
      product.gallery?.forEach((item) => expect(item.image?._status).toBe('published'))
    })
  }

  test('continua bloqueando uma imagem intencionalmente mantida como draft', async ({ page }) => {
    test.setTimeout(120_000)
    await login({ page, user: testUser })
    const stamp = Date.now() + '-draft'
    const categoryId = await createCategory(page, stamp)
    const productId = await createProduct(page, stamp, categoryId)

    const upload = await page.request.post('/api/media', {
      multipart: {
        _payload: JSON.stringify({ alt: 'Imagem propositalmente em rascunho', _status: 'draft' }),
        file: { name: 'popup-unpublished-' + stamp + '.png', mimeType: 'image/png', buffer: pixel },
      },
    })
    expect(upload.ok(), await upload.text()).toBeTruthy()
    const body = await upload.json() as { doc?: MediaResponse } & MediaResponse
    const media = body.doc || body
    expect(media.id).toBeTruthy()
    expect(media._status).toBe('draft')
    await attachImage(page, productId, media.id as ID, 1)

    const publish = await page.request.post('/api/admin-products', {
      data: {
        action: 'save-and-publish',
        id: productId,
        data: {
          title: 'Produto Popup Midia ' + stamp,
          availability: 'available',
          priceMode: 'inquiry',
        },
      },
    })
    expect(publish.status()).toBe(422)
    expect(await publish.text()).toContain('storefront.media.unpublished')

    const persisted = await page.request.get('/api/products/' + productId + '?draft=true&depth=0')
    expect(persisted.ok(), await persisted.text()).toBeTruthy()
    expect((await persisted.json() as { _status?: string })._status).toBe('draft')
  })
})
