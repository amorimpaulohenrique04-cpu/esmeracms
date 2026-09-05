import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { previewImport } from '../../src/server/domain/products/importOperations'

function payloadFixture() {
  const find = vi.fn(async ({ collection }: { collection: string }) => {
    if (collection === 'products') {
      return {
        docs: [
          {
            id: 41,
            title: 'Vaso existente',
            code: 'obj-á01',
            slug: 'vaso-existente',
            catalogStatus: 'active',
            availability: 'available',
            categories: [7],
            gallery: [{ image: 9 }],
          },
          {
            id: 42,
            title: 'Outro produto',
            code: 'OBJ-999',
            slug: 'slug-ocupado',
            catalogStatus: 'active',
            categories: [7],
            gallery: [{ image: 10 }],
          },
        ],
      }
    }
    if (collection === 'categories') {
      return { docs: [{ id: 7, title: 'Cerâmica' }, { id: 8, title: 'Vasos' }] }
    }
    throw new Error(`Coleção inesperada: ${collection}`)
  })
  return { find } as unknown as Payload
}

describe('product import preview', () => {
  it('C3/C9: resolve produto e categoria ignorando caixa e acento e agenda atualização', async () => {
    const text = [
      'nome;codigo;categoria;preco;modo_preco;disponibilidade;status;imagens;material;descricao;slug',
      'Vaso atualizado;OBJ-A01;ceramica;1.490;Fixo;Disponível;Ativo;;;Nova descrição;vaso-existente',
    ].join('\n')

    const result = await previewImport(payloadFixture(), { id: 1 }, text)

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]?.isDuplicate).toBe(true)
    expect(result.rows[0]?.existingProductId).toBe(41)
    expect(result.rows[0]?.action).toBe('update')
    expect(result.rows[0]?.issues.some((issue) => issue.code === 'category_missing')).toBe(false)
    expect(result.rows[0]?.issues.find((issue) => issue.code === 'price_ambiguous')?.severity).toBe('warning')
    expect(result.blockingCount).toBe(0)
  })

  it('C10: detecta colisão de slug no preview e sugere sufixo', async () => {
    const text = [
      'nome;codigo;categoria;preco;modo_preco;disponibilidade;status;imagens;material;descricao;slug',
      'Produto novo;OBJ-NEW;Vasos;890,00;Fixo;Disponível;Ativo;https://cdn.example.com/novo.jpg;;;slug-ocupado',
    ].join('\n')

    const result = await previewImport(payloadFixture(), { id: 1 }, text)
    const issue = result.rows[0]?.issues.find((item) => item.code === 'slug_conflict')

    expect(issue?.severity).toBe('error')
    expect(issue?.message).toContain('slug-ocupado-2')
    expect(result.blockingCount).toBeGreaterThan(0)
  })

  it('C5: reporta a linha física da planilha após linha vazia', async () => {
    const text = [
      'nome;codigo;categoria;preco;modo_preco;disponibilidade;status;imagens;material;descricao;slug',
      '',
      'Produto novo;OBJ-NEW;Vasos;890,00;Fixo;Disponível;Ativo;https://cdn.example.com/novo.jpg;;;produto-novo',
    ].join('\n')

    const result = await previewImport(payloadFixture(), { id: 1 }, text)
    expect(result.rows[0]?.sourceLine).toBe(3)
  })

  it('C11: não consome silenciosamente uma primeira linha sem cabeçalho', async () => {
    await expect(previewImport(payloadFixture(), { id: 1 }, 'Produto novo;OBJ-NEW;Vasos;890,00'))
      .rejects.toThrow('Cabeçalho não reconhecido')
  })
})
