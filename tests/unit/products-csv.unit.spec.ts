import { describe, expect, it } from 'vitest'

import { detectDelimiter, parseDelimited, parseTabularText } from '../../src/server/domain/products/csv'

describe('product import csv parser', () => {
  it('C1: detecta CSV do Excel pt-BR separado por ponto e vírgula', () => {
    const text = 'nome;codigo;preco\r\nVaso;OBJ-1;1.490,00\r\nBandeja;OBJ-2;890,00'
    expect(detectDelimiter(text)).toBe(';')
    expect(parseTabularText(text)[1]?.cells).toEqual(['Vaso', 'OBJ-1', '1.490,00'])
  })

  it('detecta vírgula e tab sem confundir delimitador dentro de aspas', () => {
    expect(detectDelimiter('nome,codigo,descricao\nVaso,OBJ-1,"verde, mineral"')).toBe(',')
    expect(detectDelimiter('nome\tcodigo\tpreco\nVaso\tOBJ-1\t890')).toBe('\t')
  })

  it('preserva aspas escapadas e quebra de linha dentro de campo', () => {
    const rows = parseDelimited('nome;descricao\nVaso;"Linha 1\nLinha ""2"""', ';')
    expect(rows).toHaveLength(2)
    expect(rows[1]?.cells).toEqual(['Vaso', 'Linha 1\nLinha "2"'])
    expect(rows[1]?.sourceLine).toBe(2)
  })

  it('C5: mantém o número físico da linha mesmo descartando linhas vazias', () => {
    const rows = parseTabularText('nome;codigo\nVaso;OBJ-1\n\nBandeja;OBJ-2')
    expect(rows.map((row) => row.sourceLine)).toEqual([1, 2, 4])
  })

  it('remove BOM UTF-8 sem alterar o primeiro cabeçalho', () => {
    const rows = parseTabularText('\uFEFFnome;codigo\nVaso;OBJ-1')
    expect(rows[0]?.cells[0]).toBe('nome')
  })
})
