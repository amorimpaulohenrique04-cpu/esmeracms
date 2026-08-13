import type { PublicationIssue } from '../../../issues/types'

export type { PublicationIssue }

export type ProductMedia = {
  id: string | number
  _status?: string | null
  url?: string | null
  filename?: string | null
  alt?: string | null
  sizes?: {
    thumb?: { url?: string | null }
    card?: { url?: string | null }
  } | null
}

export type ProductGalleryItem = {
  id?: string | number | null
  image?: ProductMedia | string | number | null
  mediaKey?: string | null
  role?: string | null
  alt?: string | null
}

export type ProductCategory = {
  id: string | number
  _status?: string | null
  status?: string | null
  title?: string | null
  slug?: string | null
}

// Categoria elegível para seleção no popup de criação: só as ativas, publicadas
// e não-agrupadoras (mesmo filtro de Products.categories.filterOptions), já com
// a imagem de Descoberta para os cards visuais do seletor.
export type ProductPickerCategory = {
  id: string | number
  title?: string | null
  slug?: string | null
  image?: ProductMedia | string | number | null
  // Relação para a categoria-pai (id ou objeto). Alimenta a seleção automática
  // de ancestrais elegíveis no seletor do popup — ver ProductCategoryPicker.
  parent?: ProductCategory | string | number | null
}

export type ProductOptionValue = {
  id?: string | number | null
  value?: string | null
  label?: string | null
  swatch?: string | null
}

export type ProductOptionDefinition = {
  id?: string | number | null
  code?: string | null
  label?: string | null
  values?: ProductOptionValue[] | null
}

export type ProductVariant = {
  id?: string | number | null
  sku?: string | null
  selection?: Array<{ id?: string | number | null; option?: string | null; value?: string | null }> | null
  priceMode?: string | null
  priceCents?: number | null
  status?: string | null
  mediaKeys?: Array<{ id?: string | number | null; key?: string | null }> | null
}

export type ProductAttribute = {
  id?: string | number | null
  label?: string | null
  value?: string | null
}

export type ProductSEO = {
  title?: string | null
  description?: string | null
  image?: ProductMedia | string | number | null
}

export type ProductListItem = {
  id: string | number
  title?: string | null
  subtitle?: string | null
  code?: string | null
  slug?: string | null
  catalogStatus?: string | null
  availability?: string | null
  _status?: string | null
  publicationReady?: boolean | null
  // Contrato compartilhado: a lista chega pronta do assessment do servidor, com
  // code, severity, path, tab, label, anchor, suggestion e source preservados.
  publicationIssues?: PublicationIssue[] | null
  categories?: Array<ProductCategory | string | number> | null
  gallery?: ProductGalleryItem[] | null
  priceMode?: string | null
  basePriceCents?: number | null
  updatedAt?: string | null
}

export type ProductDetail = ProductListItem & {
  revision?: string | null
  material?: string | null
  description?: unknown
  edition?: string | null
  attributes?: ProductAttribute[] | null
  optionDefinitions?: ProductOptionDefinition[] | null
  variants?: ProductVariant[] | null
  searchTerms?: Array<{ id?: string | number | null; term?: string | null }> | null
  tags?: Array<{ id?: string | number | null; tag?: string | null }> | null
  seo?: ProductSEO | null
  createdAt?: string | null
}

export type ProductsViewMode = 'list' | 'grid'
export type ProductDocumentTab = 'overview' | 'media' | 'commercial' | 'variants' | 'technical' | 'seo' | 'history'

export type ProductWorkspaceFilters = {
  q: string
  status: string
  availability: string
  publication: string
  category: string
  page: number
  limit: 50 | 100
  view: ProductsViewMode
}

export const availabilityLabels: Record<string, string> = {
  unique: 'Peça única',
  available: 'Disponível',
  made_to_order: 'Sob encomenda',
  limited: 'Edição limitada',
}

export const roleLabels: Record<string, string> = {
  cover: 'Capa',
  detail: 'Detalhe',
  context: 'Contexto',
  scale: 'Escala',
}

export function relationId(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

export function imageURL(item: ProductGalleryItem | undefined) {
  const image = item?.image
  if (!image || typeof image !== 'object') return null
  return image.sizes?.thumb?.url || image.sizes?.card?.url || image.url || null
}

export function coverItem(gallery: ProductGalleryItem[] | null | undefined) {
  const items = gallery || []
  return items.find((item) => item.role === 'cover') || items[0]
}
