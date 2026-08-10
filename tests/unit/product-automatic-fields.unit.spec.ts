import { describe, expect, it, vi } from 'vitest'

import { productCode } from '../../src/businessRules/products/code'
import { Products } from '../../src/collections/Products'

type ProductData = {
  code?: string
  gallery?: Array<{ alt?: string; mediaKey?: string; role?: string }>
  slug?: string
}

async function normalize(data: Record<string, unknown>, originalDoc?: Record<string, unknown>) {
  const hook = Products.hooks?.beforeValidate?.[0]
  if (typeof hook !== 'function') throw new Error('Hook beforeValidate de Products não encontrado.')
  return await hook({
    data,
    originalDoc,
    req: { payload: { find: vi.fn() } },
  } as never) as ProductData
}

describe('campos automáticos de produto', () => {
  it('gera códigos no formato operacional', () => {
    expect(productCode()).toMatch(/^OBJ-[0-9A-F]{8}$/)
  })

  it('gera code, slug e todos os metadados da galeria', async () => {
    const data = await normalize({
      title: 'Anel Solar',
      gallery: [
        { image: 1 },
        { image: 2, mediaKey: 'imagem-1', role: 'cover', alt: '  Vista lateral  ' },
        { image: 3, role: 'cover' },
      ],
    })

    expect(data.code).toMatch(/^OBJ-[0-9A-F]{8}$/)
    expect(data.slug).toBe('anel-solar')
    expect(data.gallery).toEqual([
      expect.objectContaining({ mediaKey: 'imagem-1', role: 'detail', alt: 'Anel Solar — imagem 1' }),
      expect.objectContaining({ mediaKey: 'imagem-1-2', role: 'cover', alt: 'Vista lateral' }),
      expect.objectContaining({ mediaKey: 'imagem-3', role: 'detail', alt: 'Anel Solar — imagem 3' }),
    ])
  })

  it('promove a primeira imagem a capa quando nenhuma foi marcada', async () => {
    const data = await normalize({ gallery: [{ image: 1 }, { image: 2 }] }, { title: 'Colar Lua', code: 'OBJ-EXISTE' })

    expect(data.code).toBeUndefined()
    expect(data.gallery?.map((item) => item.role)).toEqual(['cover', 'detail'])
    expect(data.gallery?.map((item) => item.alt)).toEqual(['Colar Lua — imagem 1', 'Colar Lua — imagem 2'])
  })
})
