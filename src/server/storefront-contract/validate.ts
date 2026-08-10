import { decorateIssue } from '../../issues/build'
import { ISSUE_CODES, storefrontInvalidDocumentCodes } from '../../issues/codes'
import {
  ENTITY_PATH_DOCUMENT,
  type IssueParams,
  type IssueSeverity,
  type IssueSource,
  type PublicationIssue,
} from '../../issues/types'
import {
  STOREFRONT_CONTRACT_VERSION,
  type StorefrontContractValidation,
  type StorefrontKind,
} from './types'

type UnknownRecord = Record<string, unknown>

type IssueInput = {
  code: string
  path: string
  entity: string
  severity?: IssueSeverity
  source?: IssueSource
  params?: IssueParams
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

/**
 * Aba, rótulo, âncora e copy vêm todos do registry e do catálogo — nada aqui é
 * derivado do texto da mensagem nem do prefixo do path.
 */
function issue(input: IssueInput): PublicationIssue {
  return decorateIssue({
    code: input.code,
    severity: input.severity || 'blocker',
    path: input.path,
    source: input.source || 'storefront',
    ...(input.params ? { params: input.params } : {}),
  }, input.entity)
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
  entity: string,
): PublicationIssue[] {
  const media = relation(value)
  if (!media) {
    return [issue({ code: ISSUE_CODES.storefrontMediaUrlMissing, path, entity, source: 'media' })]
  }
  if (media._status !== 'published') {
    return [issue({ code: ISSUE_CODES.storefrontMediaUnpublished, path, entity, source: 'media' })]
  }
  if (!validAbsoluteURL(media.url)) {
    return [issue({ code: ISSUE_CODES.storefrontMediaUrlMissing, path, entity, source: 'media' })]
  }
  if (!text(alt || media.alt)) {
    return [issue({ code: ISSUE_CODES.storefrontMediaAltMissing, path: `${path}.alt`, entity, source: 'media' })]
  }
  return []
}

function validateProduct(data: UnknownRecord): PublicationIssue[] {
  const issues: PublicationIssue[] = []
  const entity = 'product'
  const requiredText = [
    ['slug', ISSUE_CODES.storefrontProductSlugMissing],
    ['code', ISSUE_CODES.storefrontProductCodeMissing],
    ['title', ISSUE_CODES.storefrontProductTitleMissing],
  ] as const

  if (relationID(data.id) === null && typeof data.id !== 'string' && typeof data.id !== 'number') {
    issues.push(issue({ code: ISSUE_CODES.storefrontProductIdMissing, path: 'id', entity }))
  }
  for (const [path, code] of requiredText) {
    if (!text(data[path])) issues.push(issue({ code, path, entity }))
  }

  if (data.catalogStatus !== 'active') {
    issues.push(issue({ code: ISSUE_CODES.storefrontProductNotActive, path: 'catalogStatus', entity }))
  }

  const categories = Array.isArray(data.categories) ? data.categories : []
  if (!categories.length) {
    issues.push(issue({ code: ISSUE_CODES.storefrontProductCategoryMissing, path: 'categories', entity }))
  } else {
    categories.forEach((value, index) => {
      const category = relation(value)
      if (relationID(value) === null) {
        issues.push(issue({ code: ISSUE_CODES.storefrontProductCategoryInvalid, path: `categories.${index}`, entity }))
      } else if (category && (category.status === 'archive' || category._status === 'draft')) {
        issues.push(issue({
          code: ISSUE_CODES.storefrontProductCategoryUnpublished,
          path: `categories.${index}`,
          entity,
          params: { title: text(category.title) },
        }))
      }
    })
  }

  const allowedAvailability = new Set(['unique', 'available', 'made_to_order', 'limited'])
  if (!allowedAvailability.has(text(data.availability))) {
    issues.push(issue({ code: ISSUE_CODES.storefrontProductAvailabilityInvalid, path: 'availability', entity }))
  }

  const gallery = Array.isArray(data.gallery) ? data.gallery : []
  if (!gallery.length) {
    issues.push(issue({ code: ISSUE_CODES.storefrontProductGalleryEmpty, path: 'gallery', entity }))
  }
  let coverCount = 0
  gallery.forEach((value, index) => {
    const item = record(value)
    if (!item) {
      issues.push(issue({ code: ISSUE_CODES.storefrontProductGalleryItemInvalid, path: `gallery.${index}`, entity }))
      return
    }
    if (item.role === 'cover') coverCount += 1
    issues.push(...validateMediaRelationship(item.image, `gallery.${index}.image`, item.alt, entity))
  })
  if (gallery.length && coverCount !== 1) {
    issues.push(issue({ code: ISSUE_CODES.storefrontProductCoverCount, path: 'gallery', entity }))
  }

  if (data.priceMode !== 'fixed' && data.priceMode !== 'inquiry') {
    issues.push(issue({ code: ISSUE_CODES.storefrontProductPriceModeInvalid, path: 'priceMode', entity }))
  }
  if (data.priceMode === 'fixed') {
    const basePriceValid = typeof data.basePriceCents === 'number' && Number.isInteger(data.basePriceCents) && data.basePriceCents >= 0
    const variants = Array.isArray(data.variants) ? data.variants : []
    const variantPriceValid = variants.some((value) => {
      const variant = record(value)
      return variant?.status !== 'disabled' && variant?.priceMode === 'fixed' && typeof variant.priceCents === 'number' && Number.isInteger(variant.priceCents) && variant.priceCents >= 0
    })
    if (!basePriceValid && !variantPriceValid) {
      issues.push(issue({ code: ISSUE_CODES.storefrontProductPriceMissing, path: 'basePriceCents', entity }))
    }
  }
  return issues
}

function validateCategory(data: UnknownRecord): PublicationIssue[] {
  const issues: PublicationIssue[] = []
  const entity = 'category'
  if (!text(data.title)) issues.push(issue({ code: ISSUE_CODES.storefrontCategoryTitleMissing, path: 'title', entity }))
  if (!text(data.slug)) issues.push(issue({ code: ISSUE_CODES.storefrontCategorySlugMissing, path: 'slug', entity }))
  if (data.status !== 'active') issues.push(issue({ code: ISSUE_CODES.storefrontCategoryNotActive, path: 'status', entity }))

  if (data.image) issues.push(...validateMediaRelationship(data.image, 'image', relation(data.image)?.alt, entity))
  const parent = relation(data.parent)
  if (parent && String(parent.id) === String(data.id)) {
    issues.push(issue({ code: ISSUE_CODES.storefrontCategorySelfParent, path: 'parent', entity }))
  }
  return issues
}

function validateHome(data: UnknownRecord): PublicationIssue[] {
  const issues: PublicationIssue[] = []
  const entity = 'home'
  const disabled = new Set(Array.isArray(data.disabledSections) ? data.disabledSections.map(String) : [])
  const heroSlides = Array.isArray(data.heroSlides) ? data.heroSlides : []
  if (!disabled.has('hero') && heroSlides.length > 0) {
    const active = heroSlides.filter((value) => record(value)?.active !== false)
    active.forEach((value, index) => {
      const slide = record(value)
      if (!slide) return
      issues.push(...validateMediaRelationship(slide.desktopImage, `heroSlides.${index}.desktopImage`, relation(slide.desktopImage)?.alt, entity))
      if (slide.mobileImage) issues.push(...validateMediaRelationship(slide.mobileImage, `heroSlides.${index}.mobileImage`, relation(slide.mobileImage)?.alt, entity))
    })
  }

  const ctaFields = ['provenanceCallToAction']
  for (const path of ctaFields) {
    const cta = record(data[path])
    const target = cta ? ctaTarget(cta) : null
    if (target && !validCtaTarget(target.value)) {
      issues.push(issue({ code: ISSUE_CODES.storefrontHomeCtaInvalid, path: `${path}.${target.field}`, entity }))
    }
  }

  const provenanceSteps = Array.isArray(data.provenanceSteps) ? data.provenanceSteps : []
  provenanceSteps.forEach((value, index) => {
    const cta = record(record(value)?.link)
    const target = cta ? ctaTarget(cta) : null
    if (target && !validCtaTarget(target.value)) {
      issues.push(issue({
        code: ISSUE_CODES.storefrontHomeCtaInvalid,
        path: `provenanceSteps.${index}.link.${target.field}`,
        entity,
        severity: 'warning',
      }))
    }
  })
  return issues
}

function ctaTarget(cta: UnknownRecord): { field: string; value: string } | null {
  if (text(cta.href)) return { field: 'href', value: text(cta.href) }
  if (cta.destinationType === 'internal' && text(cta.path)) return { field: 'path', value: text(cta.path) }
  if (cta.destinationType === 'external' && text(cta.url)) return { field: 'url', value: text(cta.url) }
  return null
}

function validCtaTarget(value: string): boolean {
  return value.startsWith('/') || validAbsoluteURL(value) || value.startsWith('mailto:') || value.startsWith('tel:')
}

export function validateStorefrontSnapshot(kind: StorefrontKind, value: unknown): StorefrontContractValidation {
  const data = record(value)
  if (!data) {
    const issues = [issue({
      code: storefrontInvalidDocumentCodes[kind],
      path: ENTITY_PATH_DOCUMENT,
      entity: kind,
    })]
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
