import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2p9sAAAAASUVORK5CYII=', 'base64')

/**
 * Token de concorrência do lote: o mesmo `updatedAt` que a lista do admin
 * entrega ao cliente. Escalar, portanto idêntico em qualquer `depth`.
 */
export async function fetchProductUpdatedAt(page: Page, id: string | number): Promise<string> {
  const response = await page.request.get(`http://localhost:3000/api/products/${id}?draft=true&depth=0`)
  expect(response.ok(), await response.text()).toBeTruthy()
  const document = await response.json() as { updatedAt?: string }
  expect(document.updatedAt, 'produto sem updatedAt').toBeTruthy()
  return document.updatedAt as string
}

export async function createDraftCategory(page: Page, stamp: number | string): Promise<string | number> {
  const categoryResponse = await page.request.post('http://localhost:3000/api/categories?draft=true', {
    data: {
      title: `Categoria Concorrência ${stamp}`,
      slug: `categoria-concorrencia-${stamp}`,
      status: 'active',
      order: 10,
      _status: 'draft',
    },
  })
  expect(categoryResponse.ok(), await categoryResponse.text()).toBeTruthy()
  const categoryBody = await categoryResponse.json() as { id?: string | number; doc?: { id?: string | number } }
  const categoryId = categoryBody.id ?? categoryBody.doc?.id
  expect(categoryId).toBeTruthy()
  return categoryId as string | number
}

export async function createDraftProduct(page: Page, stamp: number | string): Promise<string | number> {
  const categoryId = await createDraftCategory(page, stamp)
  await page.request.post('http://localhost:3000/api/admin-categories', { data: { action: 'publish', id: categoryId } })

  const mediaResponse = await page.request.post('http://localhost:3000/api/media', {
    multipart: {
      _payload: JSON.stringify({ alt: 'Objeto Esméra sobre fundo neutro', _status: 'published' }),
      file: { name: `concorrencia-${stamp}.png`, mimeType: 'image/png', buffer: pixel },
    },
  })
  const mediaBody = await mediaResponse.json() as { id?: string | number; doc?: { id?: string | number } }
  const mediaId = mediaBody.id ?? mediaBody.doc?.id
  expect(mediaId).toBeTruthy()

  const productResponse = await page.request.post('http://localhost:3000/api/products?draft=true', {
    data: {
      title: `Produto Concorrência ${stamp}`,
      slug: `produto-concorrencia-${stamp}`,
      code: `CON-${stamp}`,
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
  const productId = productBody.id ?? productBody.doc?.id
  expect(productId).toBeTruthy()
  return productId as string | number
}
