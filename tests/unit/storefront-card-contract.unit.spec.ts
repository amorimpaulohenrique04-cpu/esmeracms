import { describe, expect, it } from 'vitest'

import { validateCollectionV2, validateProductDetailV2 } from '../../src/server/storefront-v2/contracts'
import {
  computeInstallment,
  publicProduct,
  resolvePaymentTerms,
  type PaymentTermsV2,
} from '../../src/server/storefront-v2/catalog'
import { STOREFRONT_CONTRACT_V2 } from '../../src/server/storefront-v2/types'

const DEFAULT_TERMS: PaymentTermsV2 = { maxInstallments: 12, interestFreeInstallments: 12, minimumInstallmentCents: 0 }

describe('resolvePaymentTerms', () => {
  it('usa padrões quando não há política', () => {
    expect(resolvePaymentTerms(undefined)).toEqual(DEFAULT_TERMS)
  })

  it('respeita e limita os valores configurados', () => {
    expect(resolvePaymentTerms({ maxInstallments: 6, interestFreeInstallments: 3, minimumInstallmentCents: 5000 }))
      .toEqual({ maxInstallments: 6, interestFreeInstallments: 3, minimumInstallmentCents: 5000 })
    expect(resolvePaymentTerms({ maxInstallments: 999 }).maxInstallments).toBe(48)
    expect(resolvePaymentTerms({ maxInstallments: 0 }).maxInstallments).toBe(1)
  })
})

describe('computeInstallment', () => {
  it('calcula a parcela (nunca texto fixo): R$ 490,00 em 12x = R$ 40,83', () => {
    const installment = computeInstallment(49000, DEFAULT_TERMS)
    expect(installment).toEqual({ count: 12, amountCents: 4083, interestFree: true })
  })

  it('reduz o número de parcelas para respeitar a parcela mínima', () => {
    // 49000 / 5000 = 9,8 → no máximo 9 parcelas de R$ 54,44
    const installment = computeInstallment(49000, { maxInstallments: 12, interestFreeInstallments: 12, minimumInstallmentCents: 5000 })
    expect(installment).toEqual({ count: 9, amountCents: 5444, interestFree: true })
  })

  it('marca juros quando as parcelas ultrapassam o teto sem juros', () => {
    const installment = computeInstallment(49000, { maxInstallments: 12, interestFreeInstallments: 6, minimumInstallmentCents: 0 })
    expect(installment?.count).toBe(12)
    expect(installment?.interestFree).toBe(false)
  })

  it('não parcela preço ausente ou zero', () => {
    expect(computeInstallment(null, DEFAULT_TERMS)).toBeNull()
    expect(computeInstallment(0, DEFAULT_TERMS)).toBeNull()
  })
})

function sampleProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    slug: 'ponta-de-esmeralda',
    code: 'OBJ-021',
    title: 'Ponta de Esmeralda',
    material: 'Rocha de Esmeralda Natural',
    edition: 'Peça única',
    availability: 'available',
    priceMode: 'fixed',
    basePriceCents: 49000,
    physicalSpecs: { heightMm: 180, weightGrams: 1200 },
    gallery: [
      { role: 'cover', alt: 'Ponta frente', image: { id: 1, url: '/orig.jpg', sizes: { productCard: { url: '/pc.jpg', width: 900, height: 1200 } } } },
      { role: 'detail', alt: 'Ponta verso', image: { id: 2, url: '/orig2.jpg' } },
    ],
    categories: [
      { id: 7, slug: 'ponta-de-esmeralda', title: 'Ponta de Esmeralda', taxonomyAxis: 'piece_type', status: 'active', _status: 'published' },
    ],
    ...overrides,
  }
}

describe('publicProduct — enriquecimento do card', () => {
  it('deriva pieceType da taxonomia, specs, isUnique e installment', () => {
    const product = publicProduct(sampleProduct(), DEFAULT_TERMS)
    expect(product.identity).toEqual({ name: 'Ponta de Esmeralda', pieceType: 'Ponta de Esmeralda', material: 'Rocha de Esmeralda Natural' })
    expect(product.pieceType).toBe('Ponta de Esmeralda')
    expect(product.isUnique).toBe(true)
    expect(product.state).toBe('available')
    expect(product.purchasable).toBe(true)
    expect(product.specs).toEqual({ heightMm: 180, widthMm: null, depthMm: null, weightGrams: 1200 })
    expect(product.pricing).toEqual({ mode: 'fixed', priceCents: 49000, installment: { count: 12, amountCents: 4083, interestFree: true } })
  })

  it('prefere o crop productCard (3:4) na imagem do card', () => {
    const product = publicProduct(sampleProduct(), DEFAULT_TERMS)
    expect(product.image?.url).toBe('/pc.jpg')
    expect(product.image?.height).toBe(1200)
  })

  it('dobra availability legado unique para available mantendo isUnique', () => {
    const product = publicProduct(sampleProduct({ availability: 'unique', edition: null }), DEFAULT_TERMS)
    expect(product.state).toBe('available')
    expect(product.isUnique).toBe(true)
  })

  it('preço sob consulta não é comprável nem parcelado', () => {
    const product = publicProduct(sampleProduct({ priceMode: 'inquiry', basePriceCents: null }), DEFAULT_TERMS)
    expect(product.purchasable).toBe(false)
    expect(product.pricing).toEqual({ mode: 'inquiry', priceCents: null, installment: null })
  })

  it('made_to_order não é comprável', () => {
    const product = publicProduct(sampleProduct({ availability: 'made_to_order' }), DEFAULT_TERMS)
    expect(product.state).toBe('made_to_order')
    expect(product.purchasable).toBe(false)
  })
})

describe('contrato do detalhe de produto', () => {
  function detail(overrides: Record<string, unknown> = {}) {
    const product = publicProduct(sampleProduct(), DEFAULT_TERMS)
    return {
      version: STOREFRONT_CONTRACT_V2,
      revision: 'abc',
      product: { ...product, description: null, gallery: product.image ? [product.image] : [], seo: null, ...overrides },
    }
  }

  it('valida um detalhe completo', () => {
    expect(validateProductDetailV2(detail())).toEqual([])
  })

  it('exige gallery e pricing', () => {
    expect(validateProductDetailV2(detail({ gallery: undefined }))).toContain('product.product.gallery precisa ser uma lista.')
    expect(validateProductDetailV2(detail({ pricing: undefined }))).toContain('product.product.pricing é obrigatório.')
  })
})

describe('contrato de coleção continua válido com itens enriquecidos', () => {
  it('aceita item com os campos aditivos do card', () => {
    const item = publicProduct(sampleProduct(), DEFAULT_TERMS)
    const collection = {
      version: STOREFRONT_CONTRACT_V2,
      revision: 'r',
      category: { id: '1', slug: 'joias', title: 'Joias', visibleFilters: [] },
      items: [item],
      pagination: { page: 1, limit: 24, totalDocs: 1, totalPages: 1 },
      facets: {},
      applied: {},
    }
    expect(validateCollectionV2(collection)).toEqual([])
  })
})
