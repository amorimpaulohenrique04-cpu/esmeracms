import type { PublicationIssue } from '../publication/types'
import {
  STOREFRONT_CONTRACT_VERSION,
  type StorefrontContractValidation,
  type StorefrontKind,
} from './types'

type UnknownRecord = Record<string, unknown>

type IssueInput = Omit<PublicationIssue, 'severity' | 'source'> & {
  severity?: PublicationIssue['severity']
}

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function relation(value: unknown): UnknownRecord | null {
  return record(value)
}

function relationID(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  const candidate = record(value)?.id
  return typeof candidate === 'string' || typeof candidate === 'number' ? candidate : null
}

function issue(input: IssueInput): PublicationIssue {
  return {
    ...input,
    severity: input.severity || 'blocker',
    source: 'storefront_contract',
  }
}

function validAbsoluteURL(value: unknown): boolean {
  try {
    const url = new URL(text(value))
    return url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === 'localhost')
  } catch {
    return false
  }
}

function validateMediaRelationship(
  value: unknown,
  path: string,
  alt: unknown,
): PublicationIssue[] {
  const media = relation(value)
  if (!media || !validAbsoluteURL(media.url)) {
    return [issue({
      id: 'storefront.media.url_missing',
      path,
      tab: path.startsWith('gallery') ? 'gallery' : null,
      anchor: path.startsWith('gallery') ? 'product-gallery' : null,
      message: 'A imagem não possui uma URL pública válida.',
      suggestion: 'Selecione novamente a mídia e confirme que ela foi publicada.',
    })]
  }
  if (!text(alt || media.alt)) {
    return [issue({
      id: 'storefront.media.alt_missing',
      path: `${path}.alt`,
      tab: path.startsWith('gallery') ? 'gallery' : null,
      anchor: path.startsWith('gallery') ? 'product-gallery' : null,
      message: 'A imagem significativa precisa de texto alternativo.',
      suggestion: 'Descreva em uma frase curta o que aparece na imagem.',
    })]
  }
  return []
}

function validateProduct(data: UnknownRecord): PublicationIssue[] {
  const issues: PublicationIssue[] = []
  const requiredText = [
    ['slug', 'storefront.product.slug_missing', 'O produto precisa de um endereço válido.'],
    ['code', 'storefront.product.code_missing', 'O produto precisa de um código único.'],
    ['title', 'storefront.product.title_missing', 'O produto precisa de um título.'],
  ] as const

  if (relationID(data.id) === null && typeof data.id !== 'string' && typeof data.id !== 'number') {
    issues.push(issue({ id: 'storefront.product.id_missing', path: 'id', message: 'O produto não possui identificador público.' }))
  }
  for (const [path, id, message] of requiredText) {
    if (!text(data[path])) issues.push(issue({ id, path, tab: 'identity', anchor: `product-${path}`, message }))
  }

  if (data.catalogStatus !== 'active') {
    issues.push(issue({
      id: 'storefront.product.not_active',
      path: 'catalogStatus',
      tab: 'identity',
      anchor: 'product-catalog-status',
      message: 'A peça precisa estar ativa para aparecer no site.',
    }))
  }

  const categories = Array.isArray(data.categories) ? data.categories : []
  if (!categories.length) {
    issues.push(issue({
      id: 'storefront.product.category_missing',
      path: 'categories',
      tab: 'identity',
      anchor: 'product-categories',
      message: 'Escolha ao menos uma categoria para o produto.',
    }))
  } else {
    categories.forEach((value, index) => {
      const category = relation(value)
      if (relationID(value) === null) {
        issues.push(issue({ id: 'storefront.product.category_invalid', path: `categories.${index}`, message: 'Existe uma categoria inválida no produto.' }))
      } else if (category && (category.status === 'archive' || category._status === 'draft')) {
        issues.push(issue({
          id: 'storefront.product.category_unpublished',
          path: `categories.${index}`,
          tab: 'identity',
          anchor: 'product-categories',
          message: `A categoria “${text(category.title) || 'selecionada'}” não está publicada e ativa.`,
          suggestion: 'Publique a categoria ou selecione outra categoria ativa.',
        }))
      }
    })
  }

  const allowedAvailability = new Set(['unique', 'available', 'made_to_order', 'limited'])
  if (!allowedAvailability.has(text(data.availability))) {
    issues.push(issue({ id: 'storefront.product.availability_invalid', path: 'availability', tab: 'commercial', anchor: 'product-availability', message: 'Defina uma disponibilidade reconhecida pelo site.' }))
  }

  const gallery = Array.isArray(data.gallery) ? data.gallery : []
  if (!gallery.length) {
    issues.push(issue({ id: 'storefront.product.gallery_empty', path: 'gallery', tab: 'gallery', anchor: 'product-gallery', message: 'Adicione ao menos uma imagem ao produto.' }))
  }
  let coverCount = 0
  gallery.forEach((value, index) => {
    const item = record(value)
    if (!item) {
      issues.push(issue({ id: 'storefront.product.gallery_item_invalid', path: `gallery.${index}`, message: 'Existe um item inválido na galeria.' }))
      return
    }
    if (item.role === 'cover') coverCount += 1
    issues.push(...validateMediaRelationship(item.image, `gallery.${index}.image`, item.alt))
  })
  if (gallery.length && coverCount !== 1) {
    issues.push(issue({
      id: 'storefront.product.cover_count',
      path: 'gallery',
      tab: 'gallery',
      anchor: 'product-gallery',
      message: 'Defina exatamente uma imagem como capa.',
    }))
  }

  if (data.priceMode !== 'fixed' && data.priceMode !== 'inquiry') {
    issues.push(issue({ id: 'storefront.product.price_mode_invalid', path: 'priceMode', tab: 'commercial', anchor: 'product-price-mode', message: 'Escolha preço fixo ou sob consulta.' }))
  }
  if (data.priceMode === 'fixed') {
    const basePriceValid = typeof data.basePriceCents === 'number' && Number.isInteger(data.basePriceCents) && data.basePriceCents >= 0
    const variants = Array.isArray(data.variants) ? data.variants : []
    const variantPriceValid = variants.some((value) => {
      const variant = record(value)
      return variant?.status !== 'disabled' && variant?.priceMode === 'fixed' && typeof variant.priceCents === 'number' && Number.isInteger(variant.priceCents) && variant.priceCents >= 0
    })
    if (!basePriceValid && !variantPriceValid) {
      issues.push(issue({
        id: 'storefront.product.price_missing',
        path: 'basePriceCents',
        tab: 'commercial',
        anchor: 'product-base-price',
        message: 'O produto está com preço fixo, mas não possui preço utilizável.',
        suggestion: 'Informe um preço em reais ou altere o modo para sob consulta.',
      }))
    }
  }
  return issues
}

function validateCategory(data: UnknownRecord): PublicationIssue[] {
  const issues: PublicationIssue[] = []
  if (!text(data.title)) issues.push(issue({ id: 'storefront.category.title_missing', path: 'title', tab: 'content', anchor: 'category-title', message: 'A categoria precisa de um nome.' }))
  if (!text(data.slug)) issues.push(issue({ id: 'storefront.category.slug_missing', path: 'slug', tab: 'content', anchor: 'category-slug', message: 'A categoria precisa de um endereço válido.' }))
  if (data.status !== 'active') issues.push(issue({ id: 'storefront.category.not_active', path: 'status', tab: 'content', anchor: 'category-status', message: 'A categoria precisa estar ativa para aparecer no catálogo.' }))

  if (data.image) issues.push(...validateMediaRelationship(data.image, 'image', relation(data.image)?.alt))
  const parent = relation(data.parent)
  if (parent && String(parent.id) === String(data.id)) {
    issues.push(issue({ id: 'storefront.category.self_parent', path: 'parent', tab: 'content', anchor: 'category-parent', message: 'A categoria não pode ser principal de si mesma.' }))
  }
  return issues
}

function validateHome(data: UnknownRecord): PublicationIssue[] {
  const issues: PublicationIssue[] = []
  const disabled = new Set(Array.isArray(data.disabledSections) ? data.disabledSections.map(String) : [])
  const heroSlides = Array.isArray(data.heroSlides) ? data.heroSlides : []
  if (!disabled.has('hero') && heroSlides.length > 0) {
    const active = heroSlides.filter((value) => record(value)?.active !== false)
    active.forEach((value, index) => {
      const slide = record(value)
      if (!slide) return
      issues.push(...validateMediaRelationship(slide.desktopImage, `heroSlides.${index}.desktopImage`, relation(slide.desktopImage)?.alt))
      if (slide.mobileImage) issues.push(...validateMediaRelationship(slide.mobileImage, `heroSlides.${index}.mobileImage`, relation(slide.mobileImage)?.alt))
    })
  }

  const ctaFields = ['provenanceCallToAction']
  for (const path of ctaFields) {
    const cta = record(data[path])
    if (cta?.href && !text(cta.href).startsWith('/') && !validAbsoluteURL(cta.href) && !text(cta.href).startsWith('mailto:') && !text(cta.href).startsWith('tel:')) {
      issues.push(issue({ id: 'storefront.home.cta_invalid', path: `${path}.href`, message: 'O destino do botão não é seguro ou reconhecido.' }))
    }
  }
  return issues
}

export function validateStorefrontSnapshot(kind: StorefrontKind, value: unknown): StorefrontContractValidation {
  const data = record(value)
  if (!data) {
    const issues = [issue({ id: `storefront.${kind}.invalid_document`, message: 'O documento público não possui um formato reconhecido.' })]
    return { contractVersion: STOREFRONT_CONTRACT_VERSION, compatible: false, status: 'incompatible', issues }
  }

  const issues = kind === 'product'
    ? validateProduct(data)
    : kind === 'category'
    ? validateCategory(data)
    : kind === 'home'
    ? validateHome(data)
    : []
  const blockers = issues.filter((entry) => entry.severity === 'blocker')
  return {
    contractVersion: STOREFRONT_CONTRACT_VERSION,
    compatible: blockers.length === 0,
    status: blockers.length === 0 ? (issues.length ? 'partial' : 'compatible') : 'incompatible',
    issues,
  }
}
