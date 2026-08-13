import { describe, expect, it } from 'vitest'

import {
  collectParentIds,
  getAncestorChain,
  getCategoryDepth,
  indexCategoriesById,
  orderCategoriesHierarchically,
} from '../../src/admin/modules/categories/hierarchy'

type Node = { id: string; parent?: string | null; order?: number }

// Árvore de referência:
//   a
//   ├─ a1
//   │  └─ a1a
//   └─ a2
//   b
const a: Node = { id: 'a', parent: null, order: 1 }
const a1: Node = { id: 'a1', parent: 'a', order: 1 }
const a1a: Node = { id: 'a1a', parent: 'a1', order: 1 }
const a2: Node = { id: 'a2', parent: 'a', order: 2 }
const b: Node = { id: 'b', parent: null, order: 2 }

describe('hierarchy helpers de Categorias', () => {
  it('reagrupa em pré-ordem: cada nó seguido dos descendentes', () => {
    // Entrada fora de pré-ordem (ramos intercalados) para provar o reagrupamento.
    const ordered = orderCategoriesHierarchically([a, b, a1, a2, a1a])
    expect(ordered.map((node) => node.id)).toEqual(['a', 'a1', 'a1a', 'a2', 'b'])
  })

  it('trata nós cujo pai foi filtrado como raízes, preservando os filhos visíveis', () => {
    // Lista filtrada sem o pai "a": a1 e a2 viram raízes; a1a continua sob a1.
    const ordered = orderCategoriesHierarchically([a1, a2, a1a])
    expect(ordered.map((node) => node.id)).toEqual(['a1', 'a1a', 'a2'])
  })

  it('não entra em laço infinito diante de um ciclo e não perde nós', () => {
    const c1: Node = { id: 'c1', parent: 'c2' }
    const c2: Node = { id: 'c2', parent: 'c1' }
    const ordered = orderCategoriesHierarchically([c1, c2])
    expect(ordered).toHaveLength(2)
    expect(new Set(ordered.map((node) => node.id))).toEqual(new Set(['c1', 'c2']))
  })

  it('retorna a cadeia de ancestrais do pai imediato até a raiz', () => {
    const byId = indexCategoriesById([a, a1, a1a, a2, b])
    expect(getAncestorChain(a1a, byId).map((node) => node.id)).toEqual(['a1', 'a'])
    expect(getAncestorChain(a, byId)).toEqual([])
  })

  it('interrompe a cadeia de ancestrais em ausência (pai fora do conjunto) sem estourar', () => {
    // a1a com apenas a1 no índice: a cadeia elegível para o seletor termina em a1.
    const partial = indexCategoriesById([a1, a1a])
    expect(getAncestorChain(a1a, partial).map((node) => node.id)).toEqual(['a1'])
  })

  it('calcula profundidade e conta pai ausente como +1 (referência órfã)', () => {
    const byId = indexCategoriesById([a, a1, a1a, a2, b])
    expect(getCategoryDepth(a, byId)).toBe(0)
    expect(getCategoryDepth(a1, byId)).toBe(1)
    expect(getCategoryDepth(a1a, byId)).toBe(2)
    const orphan: Node = { id: 'x', parent: 'ghost' }
    expect(getCategoryDepth(orphan, indexCategoriesById([orphan]))).toBe(1)
  })

  it('identifica só os pais com filhos presentes no conjunto (tipografia pai/folha)', () => {
    expect(collectParentIds([a, a1, a1a, a2, b])).toEqual(new Set(['a', 'a1']))
    // Sem a1a: a1 deixa de ter filho visível e vira folha.
    expect(collectParentIds([a, a1, a2, b])).toEqual(new Set(['a']))
  })
})
