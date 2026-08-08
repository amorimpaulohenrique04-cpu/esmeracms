export const STOREFRONT_CONTRACT_V2 = 2 as const

export type PublicMediaV2 = {
  id: string
  url: string
  alt: string
  width?: number | null
  height?: number | null
}

export type PublicSEOV2 = {
  title?: string | null
  description?: string | null
  canonical?: string | null
  noIndex?: boolean
  socialImage?: PublicMediaV2 | null
}

export type PublicContentBlockV2 = {
  id?: string | null
  blockType: string
  placement: 'before' | 'after'
  [key: string]: unknown
}

export type NavigationHighlightV2 = {
  title?: string | null
  eyebrow?: string | null
  description?: string | null
  image?: PublicMediaV2 | null
  href: string
  linkLabel?: string | null
}

export type NavigationNodeV2 = {
  id: string
  title: string
  label: string
  slug: string
  nodeType: 'collection' | 'editorial' | 'external' | 'group'
  taxonomyAxis: 'navigation' | 'piece_type' | 'collection' | 'environment' | 'campaign' | 'service'
  href: string | null
  externalURL?: string
  visibility: 'all' | 'desktop' | 'mobile'
  children: NavigationNodeV2[]
  highlights?: NavigationHighlightV2[]
}

export type StorefrontNavigationV2 = {
  version: typeof STOREFRONT_CONTRACT_V2
  revision: string
  roots: NavigationNodeV2[]
  channels?: {
    whatsapp?: string
    instagram?: string
  }
}

export type PublicProductCategoryV2 = {
  id: string
  slug: string
  title: string
  taxonomyAxis?: string | null
}

export type PublicInstallmentV2 = {
  count: number
  amountCents: number
  interestFree: boolean
}

export type PublicProductPricingV2 = {
  mode: 'fixed' | 'inquiry'
  priceCents: number | null
  installment: PublicInstallmentV2 | null
}

export type PublicProductSpecsV2 = {
  heightMm: number | null
  widthMm: number | null
  depthMm: number | null
  weightGrams: number | null
}

export type PublicProductIdentityV2 = {
  name: string
  pieceType: string | null
  material: string | null
}

// Estados públicos de disponibilidade. `unique` NÃO é estado — é característica
// da peça (isUnique), derivada de edition/availability legado.
export type PublicAvailabilityStateV2 = 'available' | 'made_to_order' | 'limited' | 'archive'

export type PublicProductV2 = {
  id: string
  slug: string
  code?: string | null
  title: string
  subtitle?: string | null
  material?: string | null
  availability?: string | null
  price?: number | null
  priceUnit: 'cent'
  image?: PublicMediaV2 | null
  hoverImage?: PublicMediaV2 | null
  categories?: PublicProductCategoryV2[]
  // Campos estruturados do card (PR2). Aditivos: consumidores antigos ignoram.
  identity?: PublicProductIdentityV2
  pieceType?: string | null
  state?: PublicAvailabilityStateV2
  isUnique?: boolean
  purchasable?: boolean
  specs?: PublicProductSpecsV2
  pricing?: PublicProductPricingV2
}

export type PublicProductDetailV2 = {
  version: typeof STOREFRONT_CONTRACT_V2
  revision: string
  product: PublicProductV2 & {
    description?: unknown
    gallery: PublicMediaV2[]
    seo?: PublicSEOV2 | null
  }
}

export type FacetV2 = {
  value: string
  label: string
  count: number
}

export type CollectionPaginationV2 = {
  page: number
  limit: number
  totalDocs: number
  totalPages: number
  hasNextPage: boolean
  nextPage: number | null
  hasPrevPage: boolean
  prevPage: number | null
}

export type CollectionAppliedFiltersV2 = {
  q?: string
  category?: string[]
  collection?: string[]
  environment?: string[]
  piece_type?: string[]
  material?: string[]
  availability?: string[]
  min?: number
  max?: number
  sort?: string
}

export type StorefrontCollectionV2 = {
  version: typeof STOREFRONT_CONTRACT_V2
  revision: string
  category: {
    id: string
    slug: string
    title: string
    eyebrow?: string | null
    description?: string | null
    image?: PublicMediaV2 | null
    nodeType: string
    taxonomyAxis: string
    visibleFilters: string[]
    defaultSort: string
    productsPerPage: number
    showProductCount: boolean
    layout: 'grid' | 'editorial'
    seo?: PublicSEOV2 | null
  }
  items: PublicProductV2[]
  pagination: CollectionPaginationV2
  facets: {
    categories?: FacetV2[]
    collections?: FacetV2[]
    environments?: FacetV2[]
    pieceTypes?: FacetV2[]
    materials?: FacetV2[]
    availability?: FacetV2[]
    price?: { min: number | null; max: number | null }
  }
  applied: CollectionAppliedFiltersV2
  editorial?: {
    before?: PublicContentBlockV2[]
    after?: PublicContentBlockV2[]
  }
}

/** Paginated catalog root used by clients that are not scoped to one collection. */
export type StorefrontProductsV2 = Omit<StorefrontCollectionV2, 'category' | 'editorial'>

export type StorefrontEditorialPageV2 = {
  version: typeof STOREFRONT_CONTRACT_V2
  revision: string
  page: {
    id: string
    slug: string
    title: string
    description?: string | null
    image?: PublicMediaV2 | null
    content: PublicContentBlockV2[]
    seo?: PublicSEOV2 | null
    breadcrumb: Array<{ title: string; href: string | null }>
    updatedAt?: string | null
  }
}
