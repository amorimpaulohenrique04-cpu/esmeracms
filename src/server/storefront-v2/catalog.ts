import type { Payload, Where } from 'payload'

import { assertCollectionV2, assertEditorialPageV2, assertNavigationV2 } from './contracts'
import { deterministicRevision } from './http'
import {
  STOREFRONT_CONTRACT_V2,
  type CollectionAppliedFiltersV2,
  type FacetV2,
  type NavigationHighlightV2,
  type NavigationNodeV2,
  type PublicContentBlockV2,
  type PublicMediaV2,
  type PublicProductV2,
  type PublicSEOV2,
  type StorefrontCollectionV2,
  type StorefrontEditorialPageV2,
  type StorefrontNavigationV2,
} from './types'

type UnknownRecord = Record<string, unknown>

type BuiltResponse<T> = {
  body: T
  lastModified: string | null
}

const MAX_TREE_DEPTH = 6
const MAX_PUBLIC_CATEGORIES = 1000
const MAX_FACET_PRODUCTS = 2000
const DEFAULT_LIMIT = 24
const MAX_LIMIT = 48
const SORTS = new Set(['editorial', 'newest', 'price_asc', 'price_desc', 'name_asc'])
const FILTERS = new Set(['category', 'collection', 'environment', 'piece_type', 'material', 'availability', 'price'])
const AVAILABILITY = new Set(['unique', 'available', 'made_to_order', 'limited'])
const AXES = new Set(['navigation', 'piece_type', 'collection', 'environment', 'campaign', 'service'])
const NODE_TYPES = new Set(['collection', 'editorial', 'external', 'group'])
const EXTERNAL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:', 'tel:'])

export class StorefrontInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorefrontInputError'
  }
}

export class StorefrontNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorefrontNotFoundError'
  }
}

export class StorefrontConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorefrontConfigurationError'
  }
}

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null
}

function records(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.map(record).filter((item): item is UnknownRecord => Boolean(item)) : []
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function nullableText(value: unknown) {
  const valueText = text(value)
  return valueText || null
}

function integer(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isInteger(value) ? value : fallback
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function relationID(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  const relation = record(value)
  return typeof relation?.id === 'string' || typeof relation?.id === 'number' ? relation.id : null
}

function relationKey(value: unknown) {
  const id = relationID(value)
  return id === null ? null : String(id)
}

function safeExternalURL(value: unknown): string | null {
  const candidate = text(value)
  if (!candidate) return null
  try {
    const url = new URL(candidate)
    return EXTERNAL_PROTOCOLS.has(url.protocol) && url.protocol !== 'javascript:' ? url.toString() : null
  } catch {
    return null
  }
}

function safeInternalPath(value: unknown) {
  const candidate = text(value)
  return /^\/(?:[a-z0-9-]+\/?)*$/.test(candidate) ? candidate : null
}

function publicMedia(value: unknown, explicitAlt?: unknown): PublicMediaV2 | null {
  const media = record(value)
  if (!media) return null
  const url = text(media.url)
  if (!url) return null
  return {
    id: String(media.id || url),
    url,
    alt: text(explicitAlt) || text(media.alt) || text(media.filename),
    width: numberValue(media.width),
    height: numberValue(media.height),
  }
}

function publicSEO(value: unknown): PublicSEOV2 | null {
  const seo = record(value)
  if (!seo) return null
  const result: PublicSEOV2 = {
    title: nullableText(seo.title),
    description: nullableText(seo.description),
    canonical: nullableText(seo.canonical),
    noIndex: booleanValue(seo.noIndex ?? seo.noindex),
    socialImage: publicMedia(seo.socialImage),
  }
  return Object.values(result).some((entry) => entry !== null && entry !== false && entry !== '') ? result : null
}

function modifiedAt(value: unknown) {
  const candidate = text(record(value)?.updatedAt)
  if (!candidate || Number.isNaN(new Date(candidate).getTime())) return null
  return candidate
}

function latestModified(values: unknown[]) {
  return values
    .map(modifiedAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || null
}

function categoryOrder(category: UnknownRecord) {
  return integer(category.order, 100)
}

function compareCategories(left: UnknownRecord, right: UnknownRecord) {
  const orderDifference = categoryOrder(left) - categoryOrder(right)
  if (orderDifference) return orderDifference
  const titleDifference = text(left.title).localeCompare(text(right.title), 'pt-BR')
  if (titleDifference) return titleDifference
  return String(left.id).localeCompare(String(right.id), 'pt-BR')
}

function hrefForCategory(category: UnknownRecord) {
  const nodeType = text(category.nodeType) || 'collection'
  const slug = text(category.slug)
  if (!slug) return null
  if (nodeType === 'collection') return `/colecao/${slug}`
  if (nodeType === 'editorial') return `/pagina/${slug}`
  if (nodeType === 'external') return safeExternalURL(category.externalURL)
  if (nodeType === 'group') return safeInternalPath(category.hubPath)
  return null
}

function categoryVisibleInMenu(category: UnknownRecord) {
  return booleanValue(record(category.menu)?.showInMenu)
}

async function loadPublicCategories(payload: Payload, depth: 0 | 1 | 2 = 1) {
  const result = await payload.find({
    collection: 'categories',
    depth,
    draft: false,
    limit: MAX_PUBLIC_CATEGORIES,
    pagination: false,
    overrideAccess: true,
    sort: ['order', 'title', 'id'],
    where: {
      and: [
        { status: { equals: 'active' } },
        { _status: { equals: 'published' } },
      ],
    },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      parent: true,
      description: true,
      image: true,
      order: true,
      nodeType: true,
      taxonomyAxis: true,
      menu: true,
      listingMode: true,
      listingRules: true,
      collectionPage: true,
      contentBlocks: true,
      menuHighlights: true,
      externalURL: true,
      hubPath: true,
      seo: true,
      updatedAt: true,
      publicationRevision: true,
      _status: true,
    },
  })
  return result.docs as unknown as UnknownRecord[]
}

function mapByID(items: UnknownRecord[]) {
  return new Map(items.map((item) => [String(item.id), item]))
}

function childrenByParent(items: UnknownRecord[]) {
  const result = new Map<string, UnknownRecord[]>()
  for (const item of items) {
    const parent = relationKey(item.parent)
    if (!parent) continue
    const current = result.get(parent) || []
    current.push(item)
    result.set(parent, current)
  }
  for (const children of result.values()) children.sort(compareCategories)
  return result
}

function publicHighlight(value: UnknownRecord, categories: Map<string, UnknownRecord>): NavigationHighlightV2 | null {
  const destinationID = relationKey(value.destination)
  const destination = destinationID ? categories.get(destinationID) : null
  const externalURL = safeExternalURL(value.externalURL)
  const href = destination ? hrefForCategory(destination) : externalURL
  if (!href) return null
  return {
    title: nullableText(value.title),
    eyebrow: nullableText(value.eyebrow),
    description: nullableText(value.description),
    image: publicMedia(value.image),
    href,
    linkLabel: nullableText(value.linkLabel),
  }
}

function buildNavigationNode(
  category: UnknownRecord,
  categories: Map<string, UnknownRecord>,
  childIndex: Map<string, UnknownRecord[]>,
  visited: Set<string>,
  depth: number,
  highlightLimit: number,
): NavigationNodeV2 | null {
  const id = String(category.id || '')
  if (!id || visited.has(id) || depth > MAX_TREE_DEPTH || !categoryVisibleInMenu(category)) return null
  const nodeType = text(category.nodeType) || 'collection'
  const taxonomyAxis = text(category.taxonomyAxis) || 'navigation'
  if (!NODE_TYPES.has(nodeType) || !AXES.has(taxonomyAxis)) return null

  const href = hrefForCategory(category)
  if (nodeType === 'external' && !href) return null

  const nextVisited = new Set(visited)
  nextVisited.add(id)
  const children = (childIndex.get(id) || [])
    .map((child) => buildNavigationNode(child, categories, childIndex, nextVisited, depth + 1, highlightLimit))
    .filter((child): child is NavigationNodeV2 => Boolean(child))

  const menu = record(category.menu)
  const highlights = records(category.menuHighlights)
    .map((item) => publicHighlight(item, categories))
    .filter((item): item is NavigationHighlightV2 => Boolean(item))
    .slice(0, Math.max(0, Math.min(4, highlightLimit)))

  return {
    id,
    title: text(category.title),
    label: text(menu?.label) || text(category.title),
    slug: text(category.slug),
    nodeType: nodeType as NavigationNodeV2['nodeType'],
    taxonomyAxis: taxonomyAxis as NavigationNodeV2['taxonomyAxis'],
    href,
    ...(nodeType === 'external' && href ? { externalURL: href } : {}),
    visibility: menu?.visibility === 'desktop' || menu?.visibility === 'mobile' ? menu.visibility : 'all',
    children,
    ...(highlights.length ? { highlights } : {}),
  }
}

function channelURL(item: UnknownRecord) {
  const direct = safeExternalURL(item.url)
  if (direct) return direct
  const value = text(item.value)
  if (!value) return null
  if (item.kind === 'whatsapp') {
    const digits = value.replace(/\D/g, '')
    return digits ? `https://wa.me/${digits}` : null
  }
  if (item.kind === 'instagram') {
    const username = value.replace(/^@/, '').trim()
    return username ? `https://instagram.com/${username}` : null
  }
  return null
}

export async function buildNavigationV2(payload: Payload): Promise<BuiltResponse<StorefrontNavigationV2>> {
  const [categories, navigation, siteSettings] = await Promise.all([
    loadPublicCategories(payload, 1),
    payload.findGlobal({ slug: 'navigation', depth: 0, draft: false, overrideAccess: true }).catch(() => ({})),
    payload.findGlobal({ slug: 'site-settings', depth: 0, draft: false, overrideAccess: true }).catch(() => ({})),
  ])
  const categoryMap = mapByID(categories)
  const childIndex = childrenByParent(categories)

  const configuredRoots = records(record(navigation)?.roots)
  const legacyRoots = Array.isArray(record(navigation)?.categoryLinks)
    ? (record(navigation)?.categoryLinks as unknown[]).map((category, index) => ({ category, order: (index + 1) * 100, highlightLimit: 2 }))
    : []
  const rootRows = configuredRoots.length ? configuredRoots : legacyRoots
  const fallbackRoots = categories
    .filter((category) => relationID(category.parent) === null && categoryVisibleInMenu(category))
    .map((category) => ({ category: category.id, order: categoryOrder(category), highlightLimit: 2 }))
  const sourceRows = rootRows.length ? rootRows : fallbackRoots

  const uniqueRoots = new Map<string, UnknownRecord>()
  for (const row of sourceRows) {
    const id = relationKey(row.category)
    if (!id || uniqueRoots.has(id) || !categoryMap.has(id)) continue
    uniqueRoots.set(id, row)
  }

  const roots = Array.from(uniqueRoots.entries())
    .sort((left, right) => {
      const orderDifference = integer(left[1].order, 100) - integer(right[1].order, 100)
      return orderDifference || compareCategories(categoryMap.get(left[0]) || {}, categoryMap.get(right[0]) || {})
    })
    .map(([id, row]) => buildNavigationNode(
      categoryMap.get(id) || {},
      categoryMap,
      childIndex,
      new Set(),
      0,
      integer(row.highlightLimit, 2),
    ))
    .filter((root): root is NavigationNodeV2 => Boolean(root))

  const channels: StorefrontNavigationV2['channels'] = {}
  for (const item of records(record(siteSettings)?.officialChannels)) {
    if (item.active === false || (item.kind !== 'whatsapp' && item.kind !== 'instagram')) continue
    const url = channelURL(item)
    if (url && item.kind === 'whatsapp' && !channels.whatsapp) channels.whatsapp = url
    if (url && item.kind === 'instagram' && !channels.instagram) channels.instagram = url
  }

  const base = {
    version: STOREFRONT_CONTRACT_V2,
    roots,
    ...(Object.keys(channels).length ? { channels } : {}),
  }
  const body: StorefrontNavigationV2 = { ...base, revision: deterministicRevision(base) }
  assertNavigationV2(body)
  return { body, lastModified: latestModified([...categories, navigation, siteSettings]) }
}

function parseList(searchParams: URLSearchParams, names: string[], allowed?: Set<string>) {
  const values = names.flatMap((name) => searchParams.getAll(name))
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)
  if (values.length > 20) throw new StorefrontInputError('Cada filtro aceita no máximo 20 valores.')
  const unique = Array.from(new Set(values))
  for (const value of unique) {
    if (value.length > 80 || !/^[\p{L}\p{N}._ -]+$/u.test(value)) throw new StorefrontInputError('Um dos valores de filtro é inválido.')
    if (allowed && !allowed.has(value)) throw new StorefrontInputError(`Valor de filtro não suportado: ${value}.`)
  }
  return unique
}

function parseInteger(searchParams: URLSearchParams, name: string, fallback: number, min: number, max: number) {
  const raw = searchParams.get(name)
  if (raw === null || raw === '') return fallback
  if (!/^\d+$/.test(raw)) throw new StorefrontInputError(`${name} precisa ser um número inteiro.`)
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new StorefrontInputError(`${name} precisa estar entre ${min} e ${max}.`)
  }
  return value
}

function parseOptionalPrice(searchParams: URLSearchParams, name: string) {
  const raw = searchParams.get(name)
  if (raw === null || raw === '') return undefined
  if (!/^\d+$/.test(raw)) throw new StorefrontInputError(`${name} precisa ser um valor inteiro em centavos.`)
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 0 || value > 100_000_000) {
    throw new StorefrontInputError(`${name} está fora do limite permitido.`)
  }
  return value
}

function sortForPayload(sort: string) {
  if (sort === 'newest') return ['-createdAt', 'id']
  if (sort === 'price_asc') return ['basePriceCents', 'id']
  if (sort === 'price_desc') return ['-basePriceCents', 'id']
  if (sort === 'name_asc') return ['title', 'id']
  return ['title', 'id']
}

function slugValues(category: UnknownRecord, key: string, fallback: string[] = []) {
  const group = record(category[key])
  return group ? records(group.materials).map((item) => text(item.value)).filter(Boolean) : fallback
}

function buildRulesWhere(category: UnknownRecord): Where | null {
  const rules = record(category.listingRules)
  if (!rules) return null
  const and: Where[] = []
  const availability = Array.isArray(rules.availability) ? rules.availability.map(text).filter((value) => AVAILABILITY.has(value)) : []
  if (availability.length) and.push({ availability: { in: availability } })
  const materials = slugValues(category, 'listingRules')
  if (materials.length) and.push({ material: { in: materials } })
  const statuses = Array.isArray(rules.productStatus) ? rules.productStatus.map(text).filter(Boolean) : []
  if (statuses.length) and.push({ catalogStatus: { in: statuses } })
  const minPrice = numberValue(rules.minPrice)
  const maxPrice = numberValue(rules.maxPrice)
  if (minPrice !== null) and.push({ basePriceCents: { greater_than_equal: minPrice } })
  if (maxPrice !== null) and.push({ basePriceCents: { less_than_equal: maxPrice } })
  const after = text(rules.publishedAfter)
  const before = text(rules.publishedBefore)
  if (after) and.push({ createdAt: { greater_than_equal: after } })
  if (before) and.push({ createdAt: { less_than_equal: before } })
  return and.length ? { and } : null
}

function descendantIDs(rootID: string, categories: UnknownRecord[]) {
  const childIndex = childrenByParent(categories)
  const result = new Set<string>([rootID])
  let frontier = [rootID]
  for (let depth = 0; frontier.length && depth < MAX_TREE_DEPTH; depth += 1) {
    const next: string[] = []
    for (const parent of frontier) {
      for (const child of childIndex.get(parent) || []) {
        const id = String(child.id)
        if (result.has(id)) continue
        result.add(id)
        next.push(id)
      }
    }
    frontier = next
  }
  if (frontier.length) throw new StorefrontConfigurationError('A taxonomia ultrapassa a profundidade pública suportada.')
  return Array.from(result)
}

function findCategoryBySlug(categories: UnknownRecord[], slug: string) {
  return categories.find((category) => text(category.slug) === slug) || null
}

function categoryIDsForSlugs(categories: UnknownRecord[], slugs: string[], axis?: string) {
  const ids: string[] = []
  for (const slug of slugs) {
    const category = categories.find((item) => text(item.slug) === slug && (!axis || text(item.taxonomyAxis) === axis))
    if (!category) throw new StorefrontInputError(`Categoria de filtro inexistente: ${slug}.`)
    ids.push(String(category.id))
  }
  return ids
}

function relationshipFilter(ids: string[]): Where | null {
  if (!ids.length) return null
  return ids.length === 1
    ? { categories: { contains: ids[0] } }
    : { or: ids.map((id) => ({ categories: { contains: id } })) }
}

function publicProduct(value: UnknownRecord): PublicProductV2 {
  const gallery = records(value.gallery)
  const cover = gallery.find((item) => item.role === 'cover') || gallery[0]
  const hover = gallery.find((item) => item !== cover && item.role !== 'cover') || gallery[1]
  const basePrice = numberValue(value.basePriceCents)
  const variantPrices = records(value.variants)
    .filter((variant) => variant.status !== 'disabled' && variant.priceMode === 'fixed')
    .map((variant) => numberValue(variant.priceCents))
    .filter((price): price is number => price !== null)
  const price = basePrice ?? (variantPrices.length ? Math.min(...variantPrices) : null)
  const categories = (Array.isArray(value.categories) ? value.categories : [])
    .map(record)
    .filter((category): category is UnknownRecord => Boolean(category))
    .filter((category) => text(category.status) === 'active' && text(category._status) !== 'draft')
    .map((category) => ({
      id: String(category.id),
      slug: text(category.slug),
      title: text(category.title),
      taxonomyAxis: nullableText(category.taxonomyAxis),
    }))

  return {
    id: String(value.id),
    slug: text(value.slug),
    code: nullableText(value.code),
    title: text(value.title),
    subtitle: nullableText(value.subtitle),
    material: nullableText(value.material),
    availability: nullableText(value.availability),
    price,
    priceUnit: 'cent',
    image: cover ? publicMedia(cover.image, cover.alt) : null,
    hoverImage: hover ? publicMedia(hover.image, hover.alt) : null,
    categories,
  }
}

function facet(values: Array<{ value: string; label: string }>) {
  const counts = new Map<string, { label: string; count: number }>()
  for (const item of values) {
    if (!item.value) continue
    const current = counts.get(item.value)
    counts.set(item.value, { label: current?.label || item.label || item.value, count: (current?.count || 0) + 1 })
  }
  return Array.from(counts.entries())
    .map(([value, item]): FacetV2 => ({ value, label: item.label, count: item.count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'pt-BR'))
}

function buildFacets(products: UnknownRecord[], visibleFilters: string[]) {
  const categories = products.flatMap((product) => records(product.categories))
  const materialValues = products.map((product) => text(product.material)).filter(Boolean)
  const availabilityValues = products.map((product) => text(product.availability)).filter(Boolean)
  const prices = products.map((product) => numberValue(product.basePriceCents)).filter((price): price is number => price !== null)
  const axisFacet = (axis: string) => facet(categories
    .filter((category) => text(category.taxonomyAxis) === axis)
    .map((category) => ({ value: text(category.slug), label: text(category.title) })))

  return {
    ...(visibleFilters.includes('category') ? {
      categories: facet(categories.map((category) => ({ value: text(category.slug), label: text(category.title) }))),
    } : {}),
    ...(visibleFilters.includes('collection') ? { collections: axisFacet('collection') } : {}),
    ...(visibleFilters.includes('environment') ? { environments: axisFacet('environment') } : {}),
    ...(visibleFilters.includes('piece_type') ? { pieceTypes: axisFacet('piece_type') } : {}),
    ...(visibleFilters.includes('material') ? { materials: facet(materialValues.map((value) => ({ value, label: value }))) } : {}),
    ...(visibleFilters.includes('availability') ? { availability: facet(availabilityValues.map((value) => ({ value, label: value.replaceAll('_', ' ') }))) } : {}),
    ...(visibleFilters.includes('price') ? { price: { min: prices.length ? Math.min(...prices) : null, max: prices.length ? Math.max(...prices) : null } } : {}),
  }
}

function sanitizeBlock(value: UnknownRecord, categoryMap: Map<string, UnknownRecord>): PublicContentBlockV2 | null {
  const blockType = text(value.blockType)
  const placement: 'before' | 'after' = value.placement === 'after' ? 'after' : 'before'
  if (!blockType) return null
  const base = { id: nullableText(value.id), blockType, placement }

  if (blockType === 'richText') return { ...base, content: value.content ?? null }
  if (blockType === 'image') return { ...base, image: publicMedia(value.image, value.alt), caption: nullableText(value.caption) }
  if (blockType === 'imageText') return {
    ...base,
    eyebrow: nullableText(value.eyebrow),
    title: nullableText(value.title),
    copy: nullableText(value.copy),
    image: publicMedia(value.image),
    imagePosition: value.imagePosition === 'right' ? 'right' : 'left',
  }
  if (blockType === 'manifesto') return {
    ...base,
    eyebrow: nullableText(value.eyebrow),
    title: nullableText(value.title),
    copy: nullableText(value.copy),
  }
  if (blockType === 'materialHighlight') return {
    ...base,
    material: nullableText(value.material),
    title: nullableText(value.title),
    copy: nullableText(value.copy),
    image: publicMedia(value.image),
  }
  if (blockType === 'cta') {
    const destinationID = relationKey(value.destination)
    const destination = destinationID ? categoryMap.get(destinationID) : null
    const href = destination ? hrefForCategory(destination) : safeExternalURL(value.externalURL)
    if (!href) return null
    return {
      ...base,
      title: nullableText(value.title),
      copy: nullableText(value.copy),
      label: nullableText(value.label),
      href,
    }
  }
  if (blockType === 'gallery') return {
    ...base,
    items: records(value.items).map((item) => publicMedia(item.image, item.alt)).filter((item): item is PublicMediaV2 => Boolean(item)),
  }
  if (blockType === 'divider') return { ...base, label: nullableText(value.label) }
  return null
}

function appliedFilters(
  q: string,
  category: string[],
  collection: string[],
  environment: string[],
  pieceType: string[],
  material: string[],
  availability: string[],
  min: number | undefined,
  max: number | undefined,
  sort: string,
): CollectionAppliedFiltersV2 {
  return {
    ...(q ? { q } : {}),
    ...(category.length ? { category } : {}),
    ...(collection.length ? { collection } : {}),
    ...(environment.length ? { environment } : {}),
    ...(pieceType.length ? { piece_type: pieceType } : {}),
    ...(material.length ? { material } : {}),
    ...(availability.length ? { availability } : {}),
    ...(min !== undefined ? { min } : {}),
    ...(max !== undefined ? { max } : {}),
    ...(sort ? { sort } : {}),
  }
}

export async function buildCollectionV2(
  payload: Payload,
  slug: string,
  searchParams: URLSearchParams,
): Promise<BuiltResponse<StorefrontCollectionV2>> {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new StorefrontInputError('Slug de coleção inválido.')

  const [categories, collectionDefaults] = await Promise.all([
    loadPublicCategories(payload, 1),
    payload.findGlobal({ slug: 'collection-page', depth: 1, draft: false, overrideAccess: true }).catch(() => ({})),
  ])
  const category = findCategoryBySlug(categories, slug)
  if (!category || text(category.nodeType) !== 'collection') throw new StorefrontNotFoundError('Coleção não encontrada.')

  const pageConfig = record(category.collectionPage)
  const defaultFilters = Array.isArray(record(collectionDefaults)?.visibleFilters)
    ? (record(collectionDefaults)?.visibleFilters as unknown[]).map(text).filter((value) => FILTERS.has(value))
    : ['category', 'material', 'availability', 'price']
  const visibleFilters = Array.isArray(pageConfig?.visibleFilters)
    ? (pageConfig?.visibleFilters as unknown[]).map(text).filter((value) => FILTERS.has(value))
    : defaultFilters
  const configuredLimit = Math.min(MAX_LIMIT, Math.max(1, integer(pageConfig?.productsPerPage, DEFAULT_LIMIT)))
  const page = parseInteger(searchParams, 'page', 1, 1, 1_000_000)
  const limit = parseInteger(searchParams, 'limit', configuredLimit, 1, MAX_LIMIT)
  const defaultSort = SORTS.has(text(pageConfig?.defaultSort)) ? text(pageConfig?.defaultSort) : 'editorial'
  const sort = text(searchParams.get('sort')) || defaultSort
  if (!SORTS.has(sort)) throw new StorefrontInputError('Ordenação não suportada.')
  const q = text(searchParams.get('q')).slice(0, 100)
  if (text(searchParams.get('q')).length > 100) throw new StorefrontInputError('A busca aceita no máximo 100 caracteres.')

  const categoryFilter = parseList(searchParams, ['category'])
  const collectionFilter = parseList(searchParams, ['collection'])
  const environmentFilter = parseList(searchParams, ['environment'])
  const pieceTypeFilter = parseList(searchParams, ['piece_type', 'type'])
  const materialFilter = parseList(searchParams, ['material'])
  const availabilityFilter = parseList(searchParams, ['availability'], AVAILABILITY)
  const min = parseOptionalPrice(searchParams, 'min')
  const max = parseOptionalPrice(searchParams, 'max')
  if (min !== undefined && max !== undefined && min > max) throw new StorefrontInputError('O preço mínimo não pode ser maior que o máximo.')

  const listingMode = text(category.listingMode) || 'assigned'
  const rootID = String(category.id)
  let listingWhere: Where
  if (listingMode === 'descendants') {
    listingWhere = relationshipFilter(descendantIDs(rootID, categories)) || { categories: { contains: rootID } }
  } else if (listingMode === 'rules') {
    const rulesWhere = buildRulesWhere(category)
    if (!rulesWhere) throw new StorefrontConfigurationError('A coleção automática não possui regras válidas.')
    listingWhere = rulesWhere
  } else if (listingMode === 'hybrid') {
    const rulesWhere = buildRulesWhere(category)
    listingWhere = rulesWhere ? { or: [{ categories: { contains: rootID } }, rulesWhere] } : { categories: { contains: rootID } }
  } else {
    listingWhere = { categories: { contains: rootID } }
  }

  const and: Where[] = [
    { catalogStatus: { equals: 'active' } },
    { _status: { equals: 'published' } },
    listingWhere,
  ]
  if (q) {
    and.push({
      or: [
        { title: { like: q } },
        { subtitle: { like: q } },
        { code: { like: q } },
        { material: { like: q } },
        { 'searchTerms.term': { like: q } },
      ],
    })
  }

  const relationshipFilters = [
    relationshipFilter(categoryIDsForSlugs(categories, categoryFilter)),
    relationshipFilter(categoryIDsForSlugs(categories, collectionFilter, 'collection')),
    relationshipFilter(categoryIDsForSlugs(categories, environmentFilter, 'environment')),
    relationshipFilter(categoryIDsForSlugs(categories, pieceTypeFilter, 'piece_type')),
  ].filter((entry): entry is Where => Boolean(entry))
  and.push(...relationshipFilters)
  if (materialFilter.length) and.push({ material: { in: materialFilter } })
  if (availabilityFilter.length) and.push({ availability: { in: availabilityFilter } })
  if (min !== undefined) and.push({ basePriceCents: { greater_than_equal: min } })
  if (max !== undefined) and.push({ basePriceCents: { less_than_equal: max } })

  const where: Where = { and }
  const [result, facetResult] = await Promise.all([
    payload.find({
      collection: 'products',
      depth: 1,
      draft: false,
      page,
      limit,
      pagination: true,
      overrideAccess: true,
      sort: sortForPayload(sort),
      where,
      select: {
        id: true,
        slug: true,
        code: true,
        title: true,
        subtitle: true,
        material: true,
        availability: true,
        priceMode: true,
        basePriceCents: true,
        variants: true,
        gallery: true,
        categories: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    payload.find({
      collection: 'products',
      depth: 1,
      draft: false,
      page: 1,
      limit: MAX_FACET_PRODUCTS,
      pagination: true,
      overrideAccess: true,
      sort: 'id',
      where,
      select: {
        id: true,
        material: true,
        availability: true,
        basePriceCents: true,
        categories: true,
      },
    }),
  ])

  if (page > Math.max(1, result.totalPages)) throw new StorefrontNotFoundError('Página da coleção inexistente.')
  const products = result.docs as unknown as UnknownRecord[]
  const facetsTruncated = facetResult.totalDocs > MAX_FACET_PRODUCTS
  const facetProducts = facetsTruncated ? [] : facetResult.docs as unknown as UnknownRecord[]
  const categoryMap = mapByID(categories)
  const blocks = records(category.contentBlocks)
    .map((block) => sanitizeBlock(block, categoryMap))
    .filter((block): block is PublicContentBlockV2 => Boolean(block))
  const before = blocks.filter((block) => block.placement === 'before')
  const after = blocks.filter((block) => block.placement === 'after')

  const base = {
    version: STOREFRONT_CONTRACT_V2,
    category: {
      id: rootID,
      slug: text(category.slug),
      title: text(category.title),
      eyebrow: nullableText(pageConfig?.eyebrow),
      description: nullableText(pageConfig?.shortDescription) || nullableText(category.description),
      image: publicMedia(category.image),
      nodeType: text(category.nodeType),
      taxonomyAxis: text(category.taxonomyAxis),
      visibleFilters,
      defaultSort,
      productsPerPage: configuredLimit,
      showProductCount: booleanValue(pageConfig?.showProductCount, true),
      layout: pageConfig?.layout === 'editorial' ? 'editorial' as const : 'grid' as const,
      seo: publicSEO(category.seo),
    },
    items: products.map(publicProduct),
    pagination: {
      page: result.page || page,
      limit,
      totalDocs: result.totalDocs,
      totalPages: result.totalPages,
      hasNextPage: Boolean(result.hasNextPage),
      nextPage: result.hasNextPage ? result.nextPage || page + 1 : null,
      hasPrevPage: Boolean(result.hasPrevPage),
      prevPage: result.hasPrevPage ? result.prevPage || Math.max(1, page - 1) : null,
    },
    facets: facetsTruncated ? {} : buildFacets(facetProducts, visibleFilters),
    applied: appliedFilters(q, categoryFilter, collectionFilter, environmentFilter, pieceTypeFilter, materialFilter, availabilityFilter, min, max, sort),
    ...((before.length || after.length) ? { editorial: { ...(before.length ? { before } : {}), ...(after.length ? { after } : {}) } } : {}),
  }
  const body: StorefrontCollectionV2 = { ...base, revision: deterministicRevision(base) }
  assertCollectionV2(body)
  return { body, lastModified: latestModified([category, collectionDefaults, ...products]) }
}

export async function buildEditorialPageV2(payload: Payload, slug: string): Promise<BuiltResponse<StorefrontEditorialPageV2>> {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new StorefrontInputError('Slug editorial inválido.')
  const categories = await loadPublicCategories(payload, 2)
  const category = findCategoryBySlug(categories, slug)
  if (!category || text(category.nodeType) !== 'editorial') throw new StorefrontNotFoundError('Página editorial não encontrada.')
  const categoryMap = mapByID(categories)
  const content = records(category.contentBlocks)
    .map((block) => sanitizeBlock(block, categoryMap))
    .filter((block): block is PublicContentBlockV2 => Boolean(block))

  const breadcrumb: Array<{ title: string; href: string | null }> = []
  const visited = new Set<string>()
  let current: UnknownRecord | null = category
  for (let depth = 0; current && depth <= MAX_TREE_DEPTH; depth += 1) {
    const id = String(current.id)
    if (visited.has(id)) throw new StorefrontConfigurationError('Ciclo detectado no breadcrumb editorial.')
    visited.add(id)
    breadcrumb.unshift({ title: text(current.title), href: hrefForCategory(current) })
    const parentID = relationKey(current.parent)
    current = parentID ? categoryMap.get(parentID) || null : null
  }

  const base = {
    version: STOREFRONT_CONTRACT_V2,
    page: {
      id: String(category.id),
      slug: text(category.slug),
      title: text(category.title),
      description: nullableText(category.description),
      image: publicMedia(category.image),
      content,
      seo: publicSEO(category.seo),
      breadcrumb,
      updatedAt: modifiedAt(category),
    },
  }
  const body: StorefrontEditorialPageV2 = { ...base, revision: deterministicRevision(base) }
  assertEditorialPageV2(body)
  return { body, lastModified: modifiedAt(category) }
}
