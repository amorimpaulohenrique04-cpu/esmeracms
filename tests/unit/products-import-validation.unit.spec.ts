import { describe, expect, it } from 'vitest'

import { importColumns } from '../../src/businessRules/products/importSchema'
import {
  emptyImportValues,
  foldKey,
  parsePrice,
  validateRowShape,
} from '../../src/businessRules/products/importValidation'

function values(input: Partial<Record<(typeof importColumns)[number], string>> = {}) {
  return Object.assign(emptyImportValues(), input)
}

describe('product import validation', () => {
  it.each([
    ['1.490', 149000, true],
    ['1.490,00', 149000, false],
    ['1,490.00', 149000, false],
    ['890', 89000, false],
    ['890,00', 89000, false],
    ['890.00', 89000, false],
    ['R$ 890,00', 89000, false],
    ['0', 0, false],
  ])('C4: interpreta %s sem erro silencioso', (raw, cents, ambiguous) => {
    const result = parsePrice(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.cents).toBe(cents)
      expect(result.ambiguous).toBe(ambiguous)
    }
  })

  it.each(['-1', 'R$ x', '1.2.3', ''])('rejeita preço inválido %s', (raw) => {
    expect(parsePrice(raw).ok).toBe(false)
  })

  it('C3/C9: foldKey ignora caixa, acentos e espaços', () => {
    expect(foldKey('  Cerâmica  ')).toBe('ceramica')
    expect(foldKey('OBJ-Á01')).toBe(foldKey('obj-a01'))
  })

  it('marca 1.490 como aviso, não bloqueio', () => {
    const issues = validateRowShape(values({
      title: 'Vaso',
      code: 'OBJ-1',
      categories: 'Vasos',
      imageUrls: 'https://cdn.example.com/vaso.jpg',
      price: '1.490',
    }), { requireActiveAssets: true })
    expect(issues.find((issue) => issue.code === 'price_ambiguous')?.severity).toBe('warning')
  })

  it('C7/C8: update parcial aceita título vazio e preserva campos vazios', () => {
    const issues = validateRowShape(values({ code: 'OBJ-1', price: '890,00' }), { allowPartialUpdate: true })
    expect(issues.some((issue) => issue.column === 'title' && issue.severity === 'error')).toBe(false)
  })

  it('não permite limpar código nem slug obrigatório com --', () => {
    const issues = validateRowShape(values({ title: 'Vaso', code: '--', slug: '--' }), { allowPartialUpdate: true })
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['code_clear', 'slug_clear']))
  })
})
