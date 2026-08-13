export type RelationshipLike<T = unknown> = string | number | T | null | undefined

export type CategoryNodeType = 'collection' | 'editorial' | 'external' | 'group'
export type CategoryTaxonomyAxis = 'navigation' | 'piece_type' | 'collection' | 'environment' | 'campaign' | 'service'
export type CategoryListingMode = 'assigned' | 'descendants' | 'rules' | 'hybrid'
export type CategorySort = 'editorial' | 'newest' | 'price_asc' | 'price_desc' | 'name_asc'
export type CategoryFilter = 'category' | 'collection' | 'environment' | 'piece_type' | 'material' | 'availability' | 'price'

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
  nodeType?: CategoryNodeType | null
  taxonomyAxis?: CategoryTaxonomyAxis | null
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

export type CategoryMenu = {
  showInMenu?: boolean | null
  label?: string | null
  visibility?: 'all' | 'desktop' | 'mobile' | null
  icon?: string | null
}

export type CategoryListingRules = {
  availability?: Array<'unique' | 'available' | 'made_to_order' | 'limited'> | null
  materials?: Array<{ id?: string | null; value?: string | null }> | null
  productStatus?: Array<'active' | 'archived'> | null
  minPrice?: number | null
  maxPrice?: number | null
  publishedAfter?: string | null
  publishedBefore?: string | null
  sort?: CategorySort | null
}

export type CategoryCollectionPage = {
  eyebrow?: string | null
  shortDescription?: string | null
  visibleFilters?: CategoryFilter[] | null
  defaultSort?: CategorySort | null
  productsPerPage?: number | null
  showProductCount?: boolean | null
  layout?: 'grid' | 'editorial' | null
}

export type CategoryListItem = {
  id: string | number
  title?: string | null
  slug?: string | null
  status?: string | null
  nodeType?: CategoryNodeType | null
  taxonomyAxis?: CategoryTaxonomyAxis | null
  order?: number | null
  parent?: RelationshipLike<CategoryParent>
  image?: RelationshipLike<CategoryMedia>
  searchTerms?: CategorySearchTerm[] | null
  _status?: string | null
  updatedAt?: string | null
  productCount: number
  depth: number
  /** Tem ao menos um filho visível na lista atual — só para tipografia pai/folha. */
  hasChildren?: boolean
}

export type CategoryDetail = CategoryListItem & {
  revision?: string | null
  description?: string | null
  menu?: CategoryMenu | null
  listingMode?: CategoryListingMode | null
  listingRules?: CategoryListingRules | null
  collectionPage?: CategoryCollectionPage | null
  externalURL?: string | null
  hubPath?: string | null
  contentBlocks?: Array<Record<string, unknown>> | null
  menuHighlights?: Array<Record<string, unknown>> | null
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
