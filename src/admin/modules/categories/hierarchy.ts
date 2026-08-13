import { relationId, type RelationshipLike } from './types'

/**
 * Travessia de hierarquia de categorias reaproveitável na camada de
 * apresentação. É deliberadamente genérica sobre "algo com `id` e `parent`"
 * para servir tanto à lista de Categorias (`CategoryParent`/`CategoryListItem`)
 * quanto ao seletor do popup de produto (`ProductPickerCategory`).
 *
 * ATENÇÃO: isto NÃO substitui `src/businessRules/categories/hierarchy.ts`, que
 * é o walk autoritativo de validação server-side (rejeição de ciclo no save).
 * Aqui só derivamos ordem/profundidade/ancestrais para a UI.
 */

export type HierarchyNode = {
  id: string | number
  parent?: RelationshipLike<{ id?: string | number | null }>
}

const MAX_HIERARCHY_WALK = 20

/** Índice `String(id) -> nó`, base de toda travessia. */
export function indexCategoriesById<T extends { id: string | number }>(nodes: T[]): Map<string, T> {
  return new Map(nodes.map((node) => [String(node.id), node]))
}

/**
 * Ancestrais do nó, do pai imediato até a raiz, na ordem em que aparecem.
 * Percorre por todos os nós presentes em `byId` (inclusive `group`), parando
 * em ciclo, ancestral ausente ou no limite defensivo. O próprio nó nunca entra.
 */
export function getAncestorChain<T extends HierarchyNode>(node: T, byId: Map<string, T>): T[] {
  const chain: T[] = []
  const visited = new Set<string>([String(node.id)])
  let parentId = relationId(node.parent)
  let guard = 0
  while (parentId !== null && guard < MAX_HIERARCHY_WALK) {
    const key = String(parentId)
    if (visited.has(key)) break
    visited.add(key)
    const parent = byId.get(key)
    if (!parent) break
    chain.push(parent)
    parentId = relationId(parent.parent)
    guard += 1
  }
  return chain
}

/**
 * Profundidade hierárquica (0 = raiz). Preserva exatamente a semântica do antigo
 * `hierarchyDepth()` de `CategoriesView`: se o pai referenciado não existe no
 * índice, conta como +1 (referência órfã) em vez de ignorar.
 */
export function getCategoryDepth<T extends HierarchyNode>(node: T, byId: Map<string, T>): number {
  const visited = new Set<string>([String(node.id)])
  let depth = 0
  let parentId = relationId(node.parent)
  while (parentId !== null && depth < MAX_HIERARCHY_WALK) {
    const key = String(parentId)
    if (visited.has(key)) return depth
    visited.add(key)
    const parent = byId.get(key)
    if (!parent) return depth + 1
    depth += 1
    parentId = relationId(parent.parent)
  }
  return depth
}

/**
 * Ordena em pré-ordem (cada nó imediatamente seguido de seus descendentes).
 * A ordem dos irmãos é a ordem de entrada — os documentos já chegam com
 * `sort: 'order'`, então isto só reagrupa por pai sem tocar o rank persistido.
 *
 * Nós cujo pai não está no conjunto viram raízes (mantendo sua posição relativa
 * de entrada), o que cobre o caso de lista filtrada por status/busca.
 */
export function orderCategoriesHierarchically<T extends HierarchyNode>(categories: T[]): T[] {
  const present = new Set(categories.map((category) => String(category.id)))
  const roots: T[] = []
  const childrenOf = new Map<string, T[]>()

  categories.forEach((category) => {
    const parentId = relationId(category.parent)
    const parentKey = parentId !== null ? String(parentId) : null
    if (parentKey && present.has(parentKey)) {
      const bucket = childrenOf.get(parentKey)
      if (bucket) bucket.push(category)
      else childrenOf.set(parentKey, [category])
    } else {
      roots.push(category)
    }
  })

  const ordered: T[] = []
  const seen = new Set<string>()
  const walk = (nodes: T[]) => {
    nodes.forEach((node) => {
      const key = String(node.id)
      if (seen.has(key)) return
      seen.add(key)
      ordered.push(node)
      const kids = childrenOf.get(key)
      if (kids) walk(kids)
    })
  }
  walk(roots)

  // Rede de segurança: qualquer nó não alcançado (ciclo defensivo) vai ao fim
  // na ordem de entrada, garantindo que nenhuma categoria suma da lista.
  categories.forEach((category) => {
    if (!seen.has(String(category.id))) ordered.push(category)
  })
  return ordered
}

/**
 * Conjunto de ids das categorias que têm ao menos um filho **presente no
 * conjunto informado** — usado só para diferenciação tipográfica pai/folha na
 * lista visível (folhas cujos filhos foram filtrados aparecem como folhas).
 */
export function collectParentIds<T extends HierarchyNode>(categories: T[]): Set<string> {
  const present = new Set(categories.map((category) => String(category.id)))
  const parents = new Set<string>()
  categories.forEach((category) => {
    const parentId = relationId(category.parent)
    if (parentId !== null && present.has(String(parentId))) parents.add(String(parentId))
  })
  return parents
}
