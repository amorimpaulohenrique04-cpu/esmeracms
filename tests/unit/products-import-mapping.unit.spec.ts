import { describe, expect, it } from 'vitest'

import { applyImportMapping, inspectImportHeaders } from '../../src/admin/modules/products/importMapping'
import { parseImportSheet } from '../../src/server/domain/products/importOperations'

describe('product import column mapping', () => {
  it('sugere cabeçalhos com erro simples de digitação', () => {
    const inspection = inspectImportHeaders('nmoe;codgio;categoria\nVaso;OBJ-1;Vasos')
    expect(inspection.mapping[0]).toBe('title')
    expect(inspection.mapping[1]).toBe('code')
    expect(inspection.missingRequired).toEqual([])
  })

  it('permite ignorar colunas extras e preserva a linha física dos dados', () => {
    const source = 'Produto;SKU interno;Notas extras\r\nVaso;OBJ-1;ignorar\r\n\r\nBandeja;OBJ-2;ignorar'
    const inspection = inspectImportHeaders(source)
    const mapped = applyImportMapping(source, inspection.delimiter, ['title', 'code', null])
    const parsed = parseImportSheet(mapped)

    expect(parsed.rows.map((row) => row.sourceLine)).toEqual([2, 4])
    expect(parsed.rows[0]?.values.title).toBe('Vaso')
    expect(parsed.rows[0]?.values.code).toBe('OBJ-1')
  })

  it('bloqueia mapeamento sem colunas obrigatórias', () => {
    expect(() => applyImportMapping('Produto;Notas\nVaso;x', ';', ['title', null]))
      .toThrow('codigo')
  })

  it('bloqueia a mesma coluna de destino duas vezes', () => {
    expect(() => applyImportMapping('Nome;Produto\nVaso;Outro', ';', ['title', 'title']))
      .toThrow('mais de uma vez')
  })
})
