export type RelationshipLike<T = unknown> = string | number | T | null | undefined

export type CategoryMedia = {
  id: string | number
  filename?: string | null
  url?: string | null
  alt?: string | null
}

export type CategoryParent = {
  id: string | number
  title?: string | null
  slug?: string | null
  status?: string | null
  order?: number | null
  parent?: RelationshipLike<CategoryParent>
}

export type CategorySearchTerm = {
  id?: string | null
  term?: string | null
}

export type CategorySeo = {
  title?: string | null
  description?: string | null
  socialImage?: RelationshipLike<CategoryMedia>
  noIndex?: boolean | null
}

export type CategoryListItem = {
  id: string | number
  title?: string | null
  slug?: string | null
  status?: string | null
  order?: number | null
  parent?: RelationshipLike<CategoryParent>
  image?: RelationshipLike<CategoryMedia>
  searchTerms?: CategorySearchTerm[] | null
  _status?: string | null
  updatedAt?: string | null
  productCount: number
  depth: number
}

export type CategoryDetail = CategoryListItem & {
  revision?: string | null
  description?: string | null
  seo?: CategorySeo | null
}

export type RelatedProduct = {
  id: string | number
  title?: string | null
  code?: string | null
  catalogStatus?: string | null
  availability?: string | null
  _status?: string | null
}

export type CategoryTab = 'general' | 'media' | 'products'

export type CategoryWorkspaceFilters = {
  q: string
  status: 'active' | 'archive'
}

export const categoryStatusLabels: Record<string, string> = {
  active: 'Ativa',
  archive: 'Arquivada',
}

export function relationId(value: RelationshipLike<{ id?: string | number | null }>) {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && (typeof value.id === 'string' || typeof value.id === 'number')) return value.id
  return null
}

export function categoryImageURL(value: RelationshipLike<CategoryMedia>) {
  if (!value || typeof value !== 'object') return null
  return value.url || null
}

export function categoryImageAlt(value: RelationshipLike<CategoryMedia>) {
  if (!value || typeof value !== 'object') return ''
  return value.alt || value.filename || ''
}
