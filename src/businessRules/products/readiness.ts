import { decorateIssues, dedupeRawIssues } from '../../issues/build'
import { ISSUE_CODES } from '../../issues/codes'
import type { PublicationIssue, RawIssue } from '../../issues/types'
import { relationshipID, type RelationshipValue } from '../relationships'

export const catalogStatuses = ['active', 'archived'] as const
export const productAvailabilities = ['unique', 'available', 'made_to_order', 'limited'] as const
export const productPriceModes = ['fixed', 'inquiry'] as const

type GalleryItem = {
  image?: RelationshipValue
  mediaKey?: string | null
  role?: string | null
  alt?: string | null
}

type OptionValue = { value?: string | null }
type OptionDefinition = { code?: string | null; values?: OptionValue[] | null }

type VariantSelection = { option?: string | null; value?: string | null }
type VariantItem = {
  sku?: string | null
  selection?: VariantSelection[] | null
  mediaKeys?: Array<{ key?: string | null }> | null
  priceMode?: string | null
  priceCents?: number | null
  status?: string | null
}

export type ProductReadinessInput = {
  _status?: string | null
  title?: string | null
  slug?: string | null
  code?: string | null
  categories?: RelationshipValue[] | null
  categoryIssues?: string[] | null
  gallery?: GalleryItem[] | null
  catalogStatus?: string | null
  availability?: string | null
  priceMode?: string | null
  basePriceCents?: number | null
  optionDefinitions?: OptionDefinition[] | null
  variants?: VariantItem[] | null
}

export type ProductReadiness = {
  ready: boolean
  issues: PublicationIssue[]
}

const normalized = (value: string | null | undefined) => String(value || '').trim().toLowerCase()
const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

const blocker = (code: string, path: string, params?: Record<string, string | number>): RawIssue => ({
  code,
  severity: 'blocker',
  path,
  source: 'readiness',
  ...(params ? { params } : {}),
})

/**
 * Decisão pura sobre as definições de opção.
 *
 * Retorna `RawIssue[]`: sem mensagem, sem sugestão, sem rótulo. Os dados do editor
 * que a copy precisa (código da opção, valor) viajam em `params`, nunca
 * interpolados numa string — é isso que impede a copy de virar chave de decisão.
 */
export function collectOptionDefinitionIssues(definitionsValue: unknown): RawIssue[] {
  const definitions = (Array.isArray(definitionsValue) ? definitionsValue : []) as OptionDefinition[]
  const raws: RawIssue[] = []
  const codes = new Set<string>()

  definitions.forEach((definition, index) => {
    const code = normalized(definition.code)
    if (!code) {
      raws.push(blocker(ISSUE_CODES.productOptionCodeMissing, `optionDefinitions.${index}.code`))
      return
    }
    if (codes.has(code)) {
      raws.push(blocker(ISSUE_CODES.productOptionCodeDuplicated, `optionDefinitions.${index}.code`, { code }))
    }
    codes.add(code)

    const values = new Set<string>()
    if (!definition.values?.length) {
      raws.push(blocker(ISSUE_CODES.productOptionValuesMissing, `optionDefinitions.${index}.values`, { code }))
    }
    ;(definition.values || []).forEach((item, valueIndex) => {
      const value = normalized(item.value)
      const path = `optionDefinitions.${index}.values.${valueIndex}.value`
      if (!value) {
        raws.push(blocker(ISSUE_CODES.productOptionValueCodeMissing, path, { code }))
        return
      }
      if (values.has(value)) {
        raws.push(blocker(ISSUE_CODES.productOptionValueDuplicated, path, { code, value }))
      }
      values.add(value)
    })
  })

  return raws
}

/** Decisão pura sobre as variantes. Ver a nota em `collectOptionDefinitionIssues`. */
export function collectVariantIssues(product: ProductReadinessInput): RawIssue[] {
  const definitions = product.optionDefinitions || []
  const variants = product.variants || []
  const raws: RawIssue[] = []
  const definitionMap = new Map(
    definitions.map((definition) => [
      normalized(definition.code),
      new Set((definition.values || []).map((item) => normalized(item.value)).filter(Boolean)),
    ]),
  )
  const galleryKeys = new Set((product.gallery || []).map((item) => normalized(item.mediaKey)).filter(Boolean))
  const skus = new Set<string>()
  const combinations = new Set<string>()

  if (definitions.length && !variants.length) {
    raws.push(blocker(ISSUE_CODES.productVariantsMissing, 'variants'))
  }
  if (variants.length && !definitions.length) {
    raws.push(blocker(ISSUE_CODES.productVariantsOptionsMissing, 'optionDefinitions'))
  }

  variants.forEach((variant, index) => {
    const sku = String(variant.sku || '').trim().toUpperCase()
    if (!sku) raws.push(blocker(ISSUE_CODES.productVariantSkuMissing, `variants.${index}.sku`))
    else if (skus.has(sku)) raws.push(blocker(ISSUE_CODES.productVariantSkuDuplicated, `variants.${index}.sku`, { sku }))
    skus.add(sku)

    const selection = variant.selection || []
    const selectedOptions = new Set(selection.map((item) => normalized(item.option)).filter(Boolean))
    if (selection.length !== selectedOptions.size) {
      raws.push(blocker(ISSUE_CODES.productVariantSelectionDuplicated, `variants.${index}.selection`, { sku }))
    }
    if (selectedOptions.size !== definitionMap.size) {
      raws.push(blocker(ISSUE_CODES.productVariantSelectionIncomplete, `variants.${index}.selection`, { sku }))
    }

    selection.forEach((item, selectionIndex) => {
      const option = normalized(item.option)
      const value = normalized(item.value)
      const allowedValues = definitionMap.get(option)
      if (!allowedValues) {
        raws.push(blocker(
          ISSUE_CODES.productVariantOptionUnknown,
          `variants.${index}.selection.${selectionIndex}.option`,
          { sku, option },
        ))
      } else if (!allowedValues.has(value)) {
        raws.push(blocker(
          ISSUE_CODES.productVariantValueUnknown,
          `variants.${index}.selection.${selectionIndex}.value`,
          { sku, value },
        ))
      }
    })

    const combination = selection
      .map((item) => `${normalized(item.option)}:${normalized(item.value)}`)
      .sort()
      .join('|')
    if (combination && combinations.has(combination)) {
      raws.push(blocker(ISSUE_CODES.productVariantCombinationDuplicated, `variants.${index}.selection`, { combination }))
    }
    if (combination) combinations.add(combination)

    ;(variant.mediaKeys || []).forEach((media, mediaIndex) => {
      const key = normalized(media.key)
      if (key && !galleryKeys.has(key)) {
        raws.push(blocker(
          ISSUE_CODES.productVariantMediaUnknown,
          `variants.${index}.mediaKeys.${mediaIndex}.key`,
          { sku, key },
        ))
      }
    })

    if (variant.priceMode === 'fixed' && !isNonNegativeInteger(variant.priceCents)) {
      raws.push(blocker(ISSUE_CODES.productVariantPriceMissing, `variants.${index}.priceCents`, { sku }))
    }
    if (variant.priceMode === 'inherit' && product.priceMode === 'fixed' && !isNonNegativeInteger(product.basePriceCents)) {
      raws.push(blocker(ISSUE_CODES.productVariantInheritedPriceMissing, `variants.${index}.priceMode`, { sku }))
    }
  })

  return dedupeRawIssues(raws)
}

/**
 * Fonte única de decisão de readiness do produto.
 *
 * Retorna `RawIssue[]` deliberadamente: nenhuma mensagem legível existe neste
 * ponto do fluxo, então é estruturalmente impossível que a copy editorial
 * influencie código, path, severidade ou a decisão de estar pronto (ERR-U02).
 */
export function collectProductReadinessIssues(product: ProductReadinessInput): RawIssue[] {
  const raws: RawIssue[] = []
  const gallery = product.gallery || []
  const categories = (product.categories || []).filter((item) => relationshipID(item) !== null)

  if (!product.title?.trim()) raws.push(blocker(ISSUE_CODES.productTitleMissing, 'title'))
  if (!product.slug?.trim()) raws.push(blocker(ISSUE_CODES.productSlugMissing, 'slug'))
  if (!product.code?.trim()) raws.push(blocker(ISSUE_CODES.productCodeMissing, 'code'))
  if (!categories.length) raws.push(blocker(ISSUE_CODES.productCategoriesMissing, 'categories'))
  if (product.categoryIssues?.length) raws.push(blocker(ISSUE_CODES.productCategoriesInactive, 'categories'))
  if (!catalogStatuses.includes(product.catalogStatus as (typeof catalogStatuses)[number])) {
    raws.push(blocker(ISSUE_CODES.productCatalogStatusInvalid, 'catalogStatus'))
  }
  if (!productAvailabilities.includes(product.availability as (typeof productAvailabilities)[number])) {
    raws.push(blocker(ISSUE_CODES.productAvailabilityMissing, 'availability'))
  }

  if (!gallery.length) raws.push(blocker(ISSUE_CODES.productGalleryEmpty, 'gallery'))
  if (gallery.length && !gallery.some((item) => relationshipID(item.image) !== null)) {
    raws.push(blocker(ISSUE_CODES.productGalleryMediaInvalid, 'gallery'))
  }
  if (gallery.length && gallery.filter((item) => item.role === 'cover').length !== 1) {
    raws.push(blocker(ISSUE_CODES.productGalleryCoverCount, 'gallery'))
  }

  raws.push(...collectOptionDefinitionIssues(product.optionDefinitions))
  raws.push(...collectVariantIssues(product))

  if (!productPriceModes.includes(product.priceMode as (typeof productPriceModes)[number])) {
    raws.push(blocker(ISSUE_CODES.productPriceModeMissing, 'priceMode'))
  } else if (product.priceMode === 'fixed') {
    const enabledVariants = (product.variants || []).filter((variant) => variant.status !== 'disabled')
    const hasBasePrice = isNonNegativeInteger(product.basePriceCents)
    const hasUsableVariantPrice = enabledVariants.some(
      (variant) => variant.priceMode === 'fixed' && isNonNegativeInteger(variant.priceCents),
    )
    if (!hasBasePrice && !hasUsableVariantPrice) {
      raws.push(blocker(ISSUE_CODES.productBasePriceMissing, 'basePriceCents'))
    }
  }

  return dedupeRawIssues(raws)
}

export function getOptionDefinitionIssues(definitionsValue: unknown): PublicationIssue[] {
  return decorateIssues(collectOptionDefinitionIssues(definitionsValue), 'product')
}

export function getVariantIssues(product: ProductReadinessInput): PublicationIssue[] {
  return decorateIssues(collectVariantIssues(product), 'product')
}

export function getProductReadiness(product: ProductReadinessInput): ProductReadiness {
  const issues = decorateIssues(collectProductReadinessIssues(product), 'product')
  return { ready: issues.every((issue) => issue.severity !== 'blocker'), issues }
}
