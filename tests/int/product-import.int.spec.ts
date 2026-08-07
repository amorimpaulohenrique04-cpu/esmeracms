import config from '@payload-config'
import { randomUUID } from 'node:crypto'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  commitImport,
  previewImport,
  type ImportCommitInput,
} from '../../src/server/domain/products/importOperations'

describe('product import against Payload', () => {
  let payload: Payload
  let userId: string | number
  let categoryId: string | number
  let productId: string | number
  const suffix = randomUUID().slice(0, 8)
  const code = `OBJ-Á${suffix}`

  beforeAll(async () => {
    payload = await getPayload({ config })
    const user = await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        name: `Import Test ${suffix}`,
        email: `import-${suffix}@example.com`,
        password: 'ImportTest!123',
        role: 'admin',
      },
    })
    userId = user.id

    const category = await payload.create({
      collection: 'categories',
      overrideAccess: true,
      draft: true,
      data: {
        title: `Cerâmica ${suffix}`,
        slug: `ceramica-${suffix}`,
      },
    })
    categoryId = category.id

    const product = await payload.create({
      collection: 'products',
      overrideAccess: true,
      data: {
        title: `Vaso existente ${suffix}`,
        slug: `vaso-existente-${suffix}`,
        code,
        catalogStatus: 'archived',
        availability: 'available',
        priceMode: 'fixed',
        basePriceCents: 89000,
      },
    })
    productId = product.id
  })

  afterAll(async () => {
    if (!payload) return
    await payload.delete({ collection: 'products', id: productId, overrideAccess: true }).catch(() => undefined)
    await payload.delete({ collection: 'categories', id: categoryId, overrideAccess: true }).catch(() => undefined)
    await payload.delete({ collection: 'users', id: userId, overrideAccess: true }).catch(() => undefined)
  })

  it('detecta duplicata/categoria por chave normalizada e interpreta preço brasileiro', async () => {
    const user = await payload.findByID({ collection: 'users', id: userId, overrideAccess: true })
    const foldedCode = code.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    const categoryWithoutAccent = `Ceramica ${suffix}`
    const text = [
      'nome;codigo;categoria;preco;modo_preco;disponibilidade;status;imagens;material;descricao;slug',
      `;${foldedCode};${categoryWithoutAccent};1.490;;;;;;;`,
    ].join('\n')

    const preview = await previewImport(payload, user, text)

    expect(preview.rows).toHaveLength(1)
    expect(preview.rows[0]?.isDuplicate).toBe(true)
    expect(preview.rows[0]?.existingProductId).toBe(productId)
    expect(preview.rows[0]?.issues.some((issue) => issue.code === 'category_missing')).toBe(false)
    expect(preview.rows[0]?.issues.find((issue) => issue.code === 'price_ambiguous')?.severity).toBe('warning')
    expect(preview.blockingCount).toBe(0)
  })

  it('atualiza apenas o preço sem exigir reenvio de título, categoria ou galeria', async () => {
    const user = await payload.findByID({ collection: 'users', id: userId, overrideAccess: true })
    const values: ImportCommitInput['values'] = {
      title: '',
      code,
      categories: '',
      price: '1.490',
      priceMode: '',
      availability: '',
      catalogStatus: '',
      imageUrls: '',
      material: '',
      description: '',
      slug: '',
    }

    const report = await commitImport(payload, user, [{
      rowIndex: 0,
      sourceLine: 2,
      values,
      onConflict: 'update',
    }])

    expect(report.updated).toBe(1)
    expect(report.errored).toBe(0)

    const updated = await payload.findByID({ collection: 'products', id: productId, overrideAccess: true })
    expect(updated.title).toBe(`Vaso existente ${suffix}`)
    expect(updated.basePriceCents).toBe(149000)
    expect(updated.catalogStatus).toBe('archived')
    expect(updated.priceMode).toBe('fixed')
  })

  it('encontra produto na lixeira, restaura e atualiza em vez de tentar criar duplicata', async () => {
    const user = await payload.findByID({ collection: 'users', id: userId, overrideAccess: true })
    const trashedCode = `TRASH-${suffix}`
    const trashed = await payload.create({
      collection: 'products',
      overrideAccess: true,
      data: {
        title: `Produto na lixeira ${suffix}`,
        slug: `produto-na-lixeira-${suffix}`,
        code: trashedCode,
        catalogStatus: 'archived',
        availability: 'available',
        priceMode: 'fixed',
        basePriceCents: 10000,
      },
    })

    await payload.update({
      collection: 'products',
      id: trashed.id,
      overrideAccess: true,
      data: { deletedAt: new Date().toISOString() } as never,
    })

    const text = [
      'nome;codigo;categoria;preco;modo_preco;disponibilidade;status;imagens;material;descricao;slug',
      `;${trashedCode};;250;;;;;;;`,
    ].join('\n')
    const preview = await previewImport(payload, user, text)

    expect(preview.rows[0]?.isDuplicate).toBe(true)
    expect(preview.rows[0]?.existingProductId).toBe(trashed.id)
    expect(preview.rows[0]?.action).toBe('update')
    expect(preview.blockingCount).toBe(0)

    const values: ImportCommitInput['values'] = {
      title: '',
      code: trashedCode,
      categories: '',
      price: '250',
      priceMode: '',
      availability: '',
      catalogStatus: '',
      imageUrls: '',
      material: '',
      description: '',
      slug: '',
    }
    const report = await commitImport(payload, user, [{
      rowIndex: 0,
      sourceLine: 2,
      values,
      onConflict: 'update',
    }])

    expect(report.created).toBe(0)
    expect(report.updated).toBe(1)
    expect(report.errored).toBe(0)

    const restored = await payload.findByID({
      collection: 'products',
      id: trashed.id,
      trash: true,
      overrideAccess: true,
    } as never) as unknown as { deletedAt?: string | null; basePriceCents?: number | null }
    expect(restored.deletedAt).toBeNull()
    expect(restored.basePriceCents).toBe(25000)

    await payload.delete({ collection: 'products', id: trashed.id, overrideAccess: true }).catch(() => undefined)
  })

  it('publica automaticamente a mídia criada pelo importador', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    )
    const media = await payload.create({
      collection: 'media',
      overrideAccess: true,
      data: {
        alt: `Imagem importada ${suffix}`,
        sourceSha256: `import-test-${suffix}`,
      },
      file: {
        data: png,
        mimetype: 'image/png',
        name: `import-test-${suffix}.png`,
        size: png.byteLength,
      },
    })

    try {
      expect(media._status).toBe('published')
    } finally {
      await payload.delete({ collection: 'media', id: media.id, overrideAccess: true }).catch(() => undefined)
    }
  })
})
