import { describe, expect, it } from 'vitest'

import {
  collectOptionDefinitionIssues,
  collectProductReadinessIssues,
  collectVariantIssues,
  getOptionDefinitionIssues,
  getProductReadiness,
  getVariantIssues,
  type ProductReadinessInput,
} from '../../src/businessRules/products/readiness'
import { decorateIssues } from '../../src/issues/build'
import { allIssueCodes, ISSUE_CODES } from '../../src/issues/codes'
import { issueCopy, type IssueCopyCatalog } from '../../src/issues/copy'
import {
  editorialFieldRegistries,
  interpolateIndices,
  resolveEditorialFieldLocation,
  splitArrayPath,
} from '../../src/issues/registry'
import { isEntityScoped, type RawIssue } from '../../src/issues/types'

/** Produto que viola simultaneamente o máximo possível de condições de readiness. */
const brokenProduct: ProductReadinessInput = {
  title: '',
  slug: '',
  code: '',
  categories: [],
  categoryIssues: ['qualquer coisa'],
  catalogStatus: 'invalid-status',
  availability: undefined,
  priceMode: undefined,
  gallery: [
    { image: null, mediaKey: 'a', role: 'cover', alt: '' },
    { image: null, mediaKey: 'b', role: 'cover', alt: '' },
  ],
  optionDefinitions: [
    { code: 'cor', values: [{ value: 'verde' }, { value: 'verde' }] },
    { code: 'cor', values: [] },
    { code: '', values: [{ value: '' }] },
  ],
  variants: [
    { sku: '', selection: [], priceMode: 'fixed', priceCents: null },
    { sku: 'SKU-1', selection: [{ option: 'cor', value: 'verde' }] },
    { sku: 'SKU-1', selection: [{ option: 'tamanho', value: 'g' }] },
    { sku: 'SKU-2', selection: [{ option: 'cor', value: 'roxo' }], mediaKeys: [{ key: 'inexistente' }] },
  ],
}

describe('ERR-U01 — readiness devolve code, path, tab e anchor estáveis', () => {
  const issues = getProductReadiness(brokenProduct).issues

  it('todo issue traz os cinco campos obrigatórios preenchidos', () => {
    expect(issues.length).toBeGreaterThan(0)
    for (const issue of issues) {
      expect(issue.code, `code vazio em ${JSON.stringify(issue)}`).toBeTruthy()
      expect(issue.path, `path vazio em ${issue.code}`).toBeTruthy()
      expect(issue.tab, `tab vazia em ${issue.code}`).toBeTruthy()
      expect(issue.label, `label vazio em ${issue.code}`).toBeTruthy()
      expect(issue.message, `message vazia em ${issue.code}`).toBeTruthy()
      expect(issue.source).toBe('readiness')
      expect(issue.severity).toBe('blocker')
    }
  })

  it('não sobrou nenhum vestígio do parser textual antigo', () => {
    expect(issues.some((issue) => /legacy_issue/.test(issue.code))).toBe(false)
    expect(issues.some((issue) => issue.path === 'publicationIssues')).toBe(false)
  })

  it('cada condição aponta para o campo real, com aba e âncora do registry', () => {
    const byCode = new Map(issues.map((issue) => [issue.code, issue]))

    expect(byCode.get(ISSUE_CODES.productTitleMissing)).toMatchObject({
      path: 'title', tab: 'identity', anchor: 'product-title', label: 'Título',
    })
    expect(byCode.get(ISSUE_CODES.productCatalogStatusInvalid)).toMatchObject({
      path: 'catalogStatus', tab: 'identity', anchor: 'product-catalog-status',
    })
    expect(byCode.get(ISSUE_CODES.productCategoriesInactive)).toMatchObject({
      path: 'categories', tab: 'identity',
    })
  })

  it('paths indexados identificam o item exato', () => {
    const paths = issues.map((issue) => issue.path)

    expect(paths).toContain('gallery.0.alt')
    expect(paths).toContain('gallery.1.alt')
    expect(paths).toContain('variants.0.sku')
    expect(paths).toContain('variants.2.sku')
    expect(paths).toContain('optionDefinitions.0.values.1.value')
    expect(paths).toContain('variants.3.mediaKeys.0.key')
  })

  it('duas variantes com o mesmo defeito são duas pendências, não uma', () => {
    // Antes a deduplicação usava a mensagem, então dois itens com o mesmo texto
    // colapsavam num só e o contador mentia.
    const skuMissing = getVariantIssues({
      optionDefinitions: [{ code: 'cor', values: [{ value: 'verde' }] }],
      variants: [
        { sku: '', selection: [{ option: 'cor', value: 'verde' }] },
        { sku: '', selection: [{ option: 'cor', value: 'verde' }] },
      ],
    }).filter((issue) => issue.code === ISSUE_CODES.productVariantSkuMissing)

    expect(skuMissing).toHaveLength(2)
    expect(skuMissing.map((issue) => issue.path)).toEqual(['variants.0.sku', 'variants.1.sku'])
  })

  it('um produto completo não gera pendência', () => {
    expect(getProductReadiness({
      title: 'Mesa Atlas',
      slug: 'mesa-atlas',
      code: 'MES-001',
      catalogStatus: 'active',
      availability: 'available',
      categories: [1],
      gallery: [{ image: 1, mediaKey: 'capa', role: 'cover', alt: 'Mesa Atlas em madeira' }],
      priceMode: 'fixed',
      basePriceCents: 150_000,
    })).toEqual({ ready: true, issues: [] })
  })
})

describe('ERR-U02 — a copy editorial não participa de nenhuma decisão', () => {
  it('a decisão é estruturalmente incapaz de ver uma mensagem', () => {
    // Esta é a garantia mais forte do contrato: `collect*` devolve RawIssue, que
    // não tem campo de mensagem nenhum. Não é convenção — é o tipo.
    const permitted = new Set(['code', 'severity', 'path', 'source', 'params'])
    const raws: RawIssue[] = [
      ...collectProductReadinessIssues(brokenProduct),
      ...collectOptionDefinitionIssues(brokenProduct.optionDefinitions),
      ...collectVariantIssues(brokenProduct),
    ]

    expect(raws.length).toBeGreaterThan(0)
    for (const raw of raws) {
      for (const key of Object.keys(raw)) {
        expect(permitted.has(key), `RawIssue não pode carregar "${key}"`).toBe(true)
      }
    }
  })

  it('trocar todo o catálogo de copy não muda código, path, aba, âncora nem readiness', () => {
    const stubCatalog: IssueCopyCatalog = Object.fromEntries(
      allIssueCodes.map((code) => [code, {
        message: () => 'XXXXXXXX',
        suggestion: 'YYYYYYYY',
      }]),
    )

    const raws = collectProductReadinessIssues(brokenProduct)
    const real = decorateIssues(raws, 'product')
    const stubbed = decorateIssues(raws, 'product', stubCatalog)

    expect(stubbed).toHaveLength(real.length)
    stubbed.forEach((issue, index) => {
      const original = real[index]
      expect(issue.code).toBe(original.code)
      expect(issue.severity).toBe(original.severity)
      expect(issue.path).toBe(original.path)
      expect(issue.tab).toBe(original.tab)
      expect(issue.label).toBe(original.label)
      expect(issue.anchor).toBe(original.anchor)
      expect(issue.source).toBe(original.source)
      // Só a apresentação muda.
      expect(issue.message).toBe('XXXXXXXX')
      expect(issue.suggestion).toBe('YYYYYYYY')
    })

    const readyReal = real.every((issue) => issue.severity !== 'blocker')
    const readyStubbed = stubbed.every((issue) => issue.severity !== 'blocker')
    expect(readyStubbed).toBe(readyReal)
  })

  it('nenhum arquivo de decisão importa o catálogo de copy para decidir', () => {
    // `collect*` não recebe catálogo: não há como injetar copy na decisão.
    expect(collectProductReadinessIssues.length).toBe(1)
    expect(collectVariantIssues.length).toBe(1)
    expect(collectOptionDefinitionIssues.length).toBe(1)
  })
})

describe('registry — resolução determinística de aba, rótulo e âncora', () => {
  it('todo código do catálogo tem copy declarada', () => {
    const missing = allIssueCodes.filter((code) => !issueCopy[code])
    expect(missing).toEqual([])
  })

  it('toda entrada do registry declara aba e rótulo não vazios', () => {
    for (const [entity, registry] of Object.entries(editorialFieldRegistries)) {
      for (const [path, location] of Object.entries(registry)) {
        expect(location.tab, `${entity}.${path} sem tab`).toBeTruthy()
        expect(location.label, `${entity}.${path} sem label`).toBeTruthy()
      }
    }
  })

  it('separa índices do path sem perder a chave', () => {
    expect(splitArrayPath('gallery.1.alt')).toEqual({ key: 'gallery.alt', indices: [1] })
    expect(splitArrayPath('variants.0.selection.2.option')).toEqual({
      key: 'variants.selection.option',
      indices: [0, 2],
    })
    expect(splitArrayPath('title')).toEqual({ key: 'title', indices: [] })
  })

  it('interpola índices em base 1', () => {
    expect(interpolateIndices('imagem {1}', [1])).toBe('imagem 2')
    expect(interpolateIndices('Valor {2} da opção {1}', [0, 2])).toBe('Valor 3 da opção 1')
  })

  it('resolve o exemplo do plano exatamente', () => {
    expect(resolveEditorialFieldLocation('product', 'gallery.1.alt')).toEqual({
      tab: 'gallery',
      label: 'Texto alternativo da imagem 2',
      anchor: 'product-gallery-item-2-alt',
    })
  })

  it('resolve caminhos com dois índices', () => {
    expect(resolveEditorialFieldLocation('product', 'optionDefinitions.0.values.2.value')).toEqual({
      tab: 'variants',
      label: 'Valor 3 da opção 1',
      anchor: 'product-option-1-value-3',
    })
  })

  it('um path desconhecido cai no fallback sem inventar rótulo', () => {
    const location = resolveEditorialFieldLocation('product', 'campoQueNaoExiste')
    expect(location.tab).toBe('review')
    expect(location.label).toBe('campoQueNaoExiste')
    expect(location.anchor).toBeUndefined()
  })

  it('reconhece paths de escopo de entidade', () => {
    expect(isEntityScoped('$document')).toBe(true)
    expect(isEntityScoped('$revision')).toBe(true)
    expect(isEntityScoped('_status')).toBe(false)
    expect(isEntityScoped('variants.0.sku')).toBe(false)
  })
})

describe('compatibilidade com o validate de campo do Payload', () => {
  it('a primeira mensagem continua disponível e a ordem de emissão é preservada', () => {
    const issues = getOptionDefinitionIssues([{ code: '', values: [] }])
    expect(issues[0]?.message).toBe('Existe uma opção sem código.')
    expect(issues[0]?.code).toBe(ISSUE_CODES.productOptionCodeMissing)
  })
})
