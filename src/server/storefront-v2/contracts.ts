import {
  STOREFRONT_CONTRACT_V2,
  type NavigationNodeV2,
  type StorefrontCollectionV2,
  type StorefrontEditorialPageV2,
  type StorefrontNavigationV2,
} from './types'

type UnknownRecord = Record<string, unknown>

export type ContractV2Kind = 'navigation' | 'collection' | 'editorial'

export class StorefrontContractV2Error extends Error {
  constructor(
    public readonly kind: ContractV2Kind,
    public readonly issues: string[],
  ) {
    super(`Contrato storefront V2 inválido (${kind}): ${issues.join('; ')}`)
    this.name = 'StorefrontContractV2Error'
  }
}

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null
}

function nonEmptyText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
}

function validateNode(node: unknown, path: string, depth: number, visited: Set<string>, issues: string[]) {
  const data = record(node)
  if (!data) {
    issues.push(`${path} precisa ser um objeto.`)
    return
  }
  if (!nonEmptyText(data.id)) issues.push(`${path}.id é obrigatório.`)
  if (!nonEmptyText(data.title)) issues.push(`${path}.title é obrigatório.`)
  if (!nonEmptyText(data.label)) issues.push(`${path}.label é obrigatório.`)
  if (!nonEmptyText(data.slug)) issues.push(`${path}.slug é obrigatório.`)

  const id = String(data.id || '')
  if (id && visited.has(id)) {
    issues.push(`${path} contém um ciclo ou duplicata.`)
    return
  }
  const nextVisited = new Set(visited)
  if (id) nextVisited.add(id)

  if (depth > 6) issues.push(`${path} ultrapassa a profundidade pública máxima.`)
  if (!Array.isArray(data.children)) {
    issues.push(`${path}.children precisa ser uma lista.`)
  } else {
    data.children.forEach((child, index) => validateNode(child, `${path}.children.${index}`, depth + 1, nextVisited, issues))
  }

  if (data.nodeType === 'external' && !nonEmptyText(data.externalURL) && !nonEmptyText(data.href)) {
    issues.push(`${path} externo precisa de URL.`)
  }
}

export function validateNavigationV2(value: unknown): string[] {
  const issues: string[] = []
  const data = record(value)
  if (!data) return ['navigation precisa ser um objeto.']
  if (data.version !== STOREFRONT_CONTRACT_V2) issues.push('navigation.version precisa ser 2.')
  if (!nonEmptyText(data.revision)) issues.push('navigation.revision é obrigatória.')
  if (!Array.isArray(data.roots)) {
    issues.push('navigation.roots precisa ser uma lista.')
  } else {
    const rootIDs = new Set<string>()
    data.roots.forEach((root, index) => {
      const item = record(root)
      const id = String(item?.id || '')
      if (id && rootIDs.has(id)) issues.push(`navigation.roots.${index} está duplicada.`)
      if (id) rootIDs.add(id)
      validateNode(root, `navigation.roots.${index}`, 0, new Set(), issues)
    })
  }
  return issues
}

export function validateCollectionV2(value: unknown): string[] {
  const issues: string[] = []
  const data = record(value)
  if (!data) return ['collection precisa ser um objeto.']
  if (data.version !== STOREFRONT_CONTRACT_V2) issues.push('collection.version precisa ser 2.')
  if (!nonEmptyText(data.revision)) issues.push('collection.revision é obrigatória.')

  const category = record(data.category)
  if (!category) issues.push('collection.category é obrigatória.')
  else {
    if (!nonEmptyText(category.id)) issues.push('collection.category.id é obrigatório.')
    if (!nonEmptyText(category.slug)) issues.push('collection.category.slug é obrigatório.')
    if (!nonEmptyText(category.title)) issues.push('collection.category.title é obrigatório.')
    if (!Array.isArray(category.visibleFilters)) issues.push('collection.category.visibleFilters precisa ser uma lista.')
  }

  if (!Array.isArray(data.items)) issues.push('collection.items precisa ser uma lista.')
  else {
    const ids = new Set<string>()
    data.items.forEach((item, index) => {
      const product = record(item)
      if (!product) {
        issues.push(`collection.items.${index} precisa ser um objeto.`)
        return
      }
      const id = String(product.id || '')
      if (!id) issues.push(`collection.items.${index}.id é obrigatório.`)
      if (id && ids.has(id)) issues.push(`collection.items.${index} está duplicado.`)
      if (id) ids.add(id)
      if (!nonEmptyText(product.slug)) issues.push(`collection.items.${index}.slug é obrigatório.`)
      if (!nonEmptyText(product.title)) issues.push(`collection.items.${index}.title é obrigatório.`)
      if (product.priceUnit !== 'cent') issues.push(`collection.items.${index}.priceUnit precisa ser cent.`)
    })
  }

  const pagination = record(data.pagination)
  if (!pagination) issues.push('collection.pagination é obrigatória.')
  else {
    for (const key of ['page', 'limit', 'totalDocs', 'totalPages'] as const) {
      if (typeof pagination[key] !== 'number' || !Number.isInteger(pagination[key]) || Number(pagination[key]) < 0) {
        issues.push(`collection.pagination.${key} precisa ser inteiro não negativo.`)
      }
    }
    if (pagination.page === 0) issues.push('collection.pagination.page começa em 1.')
    if (pagination.limit === 0 || Number(pagination.limit) > 48) issues.push('collection.pagination.limit precisa estar entre 1 e 48.')
  }
  if (!record(data.facets)) issues.push('collection.facets é obrigatório.')
  if (!record(data.applied)) issues.push('collection.applied é obrigatório.')
  return issues
}

export function validateEditorialPageV2(value: unknown): string[] {
  const issues: string[] = []
  const data = record(value)
  if (!data) return ['editorial precisa ser um objeto.']
  if (data.version !== STOREFRONT_CONTRACT_V2) issues.push('editorial.version precisa ser 2.')
  if (!nonEmptyText(data.revision)) issues.push('editorial.revision é obrigatória.')
  const page = record(data.page)
  if (!page) return [...issues, 'editorial.page é obrigatória.']
  if (!nonEmptyText(page.id)) issues.push('editorial.page.id é obrigatório.')
  if (!nonEmptyText(page.slug)) issues.push('editorial.page.slug é obrigatório.')
  if (!nonEmptyText(page.title)) issues.push('editorial.page.title é obrigatório.')
  if (!Array.isArray(page.content)) issues.push('editorial.page.content precisa ser uma lista.')
  if (!Array.isArray(page.breadcrumb)) issues.push('editorial.page.breadcrumb precisa ser uma lista.')
  return issues
}

export function assertNavigationV2(value: unknown): asserts value is StorefrontNavigationV2 {
  const issues = validateNavigationV2(value)
  if (issues.length) throw new StorefrontContractV2Error('navigation', issues)
}

export function assertCollectionV2(value: unknown): asserts value is StorefrontCollectionV2 {
  const issues = validateCollectionV2(value)
  if (issues.length) throw new StorefrontContractV2Error('collection', issues)
}

export function assertEditorialPageV2(value: unknown): asserts value is StorefrontEditorialPageV2 {
  const issues = validateEditorialPageV2(value)
  if (issues.length) throw new StorefrontContractV2Error('editorial', issues)
}

export function isNavigationNodeV2(value: unknown): value is NavigationNodeV2 {
  const issues: string[] = []
  validateNode(value, 'node', 0, new Set(), issues)
  return issues.length === 0
}
