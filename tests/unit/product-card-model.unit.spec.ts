import { describe, expect, it } from 'vitest'

import { Media } from '../../src/collections/Media'
import { Products } from '../../src/collections/Products'
import { SiteSettings } from '../../src/globals/SiteSettings'

type AnyField = {
  name?: string
  type?: string
  fields?: AnyField[]
  tabs?: Array<{ fields?: AnyField[] }>
}

/** Achata tabs/rows/groups para localizar um campo por nome em qualquer profundidade. */
function findField(fields: AnyField[] | undefined, name: string): AnyField | null {
  for (const field of fields || []) {
    if (field.name === name) return field
    const nested = findField(field.fields, name)
    if (nested) return nested
    for (const tab of field.tabs || []) {
      const inTab = findField(tab.fields, name)
      if (inTab) return inTab
    }
  }
  return null
}

describe('PR1 — modelo do card de produto', () => {
  it('Media expõe o crop productCard em 3:4 (900×1200)', () => {
    const sizes = Media.upload && typeof Media.upload === 'object' ? Media.upload.imageSizes || [] : []
    const productCard = sizes.find((size) => size.name === 'productCard')
    expect(productCard).toBeTruthy()
    expect(productCard?.width).toBe(900)
    expect(productCard?.height).toBe(1200)
    // 900/1200 = 3/4
    expect((productCard!.width as number) / (productCard!.height as number)).toBeCloseTo(3 / 4, 5)
  })

  it('Products tem specs físicas estruturadas em vez de só atributos livres', () => {
    const specs = findField(Products.fields as AnyField[], 'physicalSpecs')
    expect(specs?.type).toBe('group')
    for (const dimension of ['heightMm', 'widthMm', 'depthMm', 'weightGrams']) {
      const field = findField(specs?.fields, dimension)
      expect(field, `campo ${dimension} ausente`).toBeTruthy()
      expect(field?.type).toBe('number')
    }
  })

  it('availability mantém unique no enum apenas como legado durante a transição', () => {
    const availability = findField(Products.fields as AnyField[], 'availability') as
      | (AnyField & { options?: Array<{ value?: string }> })
      | null
    const values = (availability?.options || []).map((option) => option.value)
    expect(values).toContain('available')
    expect(values).toContain('unique')
  })

  it('SiteSettings centraliza a política de parcelamento', () => {
    const terms = findField(SiteSettings.fields as AnyField[], 'paymentTerms')
    expect(terms?.type).toBe('group')
    for (const field of ['maxInstallments', 'interestFreeInstallments', 'minimumInstallmentCents']) {
      const found = findField(terms?.fields, field)
      expect(found, `campo ${field} ausente`).toBeTruthy()
      expect(found?.type).toBe('number')
    }
  })
})
