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
  issues: string[]
}

const normalized = (value: string | null | undefined) => String(value || '').trim().toLowerCase()
const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

export function getOptionDefinitionIssues(definitionsValue: unknown) {
  const definitions = (Array.isArray(definitionsValue) ? definitionsValue : []) as OptionDefinition[]
  const issues: string[] = []
  const codes = new Set<string>()

  for (const definition of definitions) {
    const code = normalized(definition.code)
    if (!code) {
      issues.push('Existe uma opção sem código.')
      continue
    }
    if (codes.has(code)) issues.push(`O código de opção “${code}” está repetido.`)
    codes.add(code)

    const values = new Set<string>()
    if (!definition.values?.length) issues.push(`A opção “${code}” não possui valores.`)
    for (const item of definition.values || []) {
      const value = normalized(item.value)
      if (!value) {
        issues.push(`A opção “${code}” possui um valor sem código.`)
        continue
      }
      if (values.has(value)) issues.push(`O valor “${value}” está repetido na opção “${code}”.`)
      values.add(value)
    }
  }

  return issues
}

export function getVariantIssues(product: ProductReadinessInput) {
  const definitions = product.optionDefinitions || []
  const variants = product.variants || []
  const issues: string[] = []
  const definitionMap = new Map(
    definitions.map((definition) => [
      normalized(definition.code),
      new Set((definition.values || []).map((item) => normalized(item.value)).filter(Boolean)),
    ]),
  )
  const galleryKeys = new Set((product.gallery || []).map((item) => normalized(item.mediaKey)).filter(Boolean))
  const skus = new Set<string>()
  const combinations = new Set<string>()

  if (definitions.length && !variants.length) issues.push('As opções cadastradas ainda não possuem variantes.')
  if (variants.length && !definitions.length) issues.push('Existem variantes sem definições de opções.')

  for (const variant of variants) {
    const sku = String(variant.sku || '').trim().toUpperCase()
    if (!sku) issues.push('Existe uma variante sem SKU.')
    else if (skus.has(sku)) issues.push(`O SKU “${sku}” está repetido neste produto.`)
    skus.add(sku)

    const selection = variant.selection || []
    const selectedOptions = new Set(selection.map((item) => normalized(item.option)).filter(Boolean))
    if (selection.length !== selectedOptions.size) issues.push(`A variante “${sku || 'sem SKU'}” repete uma opção.`)
    if (selectedOptions.size !== definitionMap.size) {
      issues.push(`A variante “${sku || 'sem SKU'}” deve selecionar exatamente um valor de cada opção.`)
    }

    for (const item of selection) {
      const option = normalized(item.option)
      const value = normalized(item.value)
      const allowedValues = definitionMap.get(option)
      if (!allowedValues) issues.push(`A variante “${sku || 'sem SKU'}” usa a opção inexistente “${option}”.`)
      else if (!allowedValues.has(value)) issues.push(`A variante “${sku || 'sem SKU'}” usa o valor inexistente “${value}”.`)
    }

    const combination = selection
      .map((item) => `${normalized(item.option)}:${normalized(item.value)}`)
      .sort()
      .join('|')
    if (combination && combinations.has(combination)) issues.push(`A combinação “${combination}” está duplicada.`)
    if (combination) combinations.add(combination)

    for (const media of variant.mediaKeys || []) {
      const key = normalized(media.key)
      if (key && !galleryKeys.has(key)) issues.push(`A variante “${sku || 'sem SKU'}” usa a mídia inexistente “${key}”.`)
    }

    if (variant.priceMode === 'fixed' && !isNonNegativeInteger(variant.priceCents)) {
      issues.push(`A variante “${sku || 'sem SKU'}” está com preço fixo, mas não possui preço válido.`)
    }
    if (variant.priceMode === 'inherit' && product.priceMode === 'fixed' && !isNonNegativeInteger(product.basePriceCents)) {
      issues.push(`A variante “${sku || 'sem SKU'}” herda um preço base inexistente.`)
    }
  }

  return [...new Set(issues)]
}

export function getProductReadiness(product: ProductReadinessInput): ProductReadiness {
  const issues: string[] = []
  const gallery = product.gallery || []
  const categories = (product.categories || []).filter((item) => relationshipID(item) !== null)

  if (!product.title?.trim()) issues.push('Título não definido.')
  if (!product.slug?.trim()) issues.push('Slug não definido.')
  if (!product.code?.trim()) issues.push('Código não definido.')
  if (!categories.length) issues.push('Categoria não definida.')
  issues.push(...(product.categoryIssues || []))
  if (!catalogStatuses.includes(product.catalogStatus as (typeof catalogStatuses)[number])) issues.push('Status de catálogo inválido.')
  if (!productAvailabilities.includes(product.availability as (typeof productAvailabilities)[number])) issues.push('Disponibilidade não definida.')

  if (!gallery.length) issues.push('Produto sem imagem.')
  if (gallery.length && !gallery.some((item) => relationshipID(item.image) !== null)) issues.push('Galeria sem mídia válida.')
  if (gallery.some((item) => !item.alt?.trim())) issues.push('Existe imagem sem texto alternativo.')
  if (gallery.length && gallery.filter((item) => item.role === 'cover').length !== 1) issues.push('Defina exatamente uma imagem de capa.')

  issues.push(...getOptionDefinitionIssues(product.optionDefinitions))
  issues.push(...getVariantIssues(product))

  if (!productPriceModes.includes(product.priceMode as (typeof productPriceModes)[number])) {
    issues.push('Modo de preço não definido.')
  } else if (product.priceMode === 'fixed') {
    const enabledVariants = (product.variants || []).filter((variant) => variant.status !== 'disabled')
    const hasBasePrice = isNonNegativeInteger(product.basePriceCents)
    const hasUsableVariantPrice = enabledVariants.some(
      (variant) => variant.priceMode === 'fixed' && isNonNegativeInteger(variant.priceCents),
    )
    if (!hasBasePrice && !hasUsableVariantPrice) issues.push('Produto com preço fixo sem preço utilizável.')
  }

  const uniqueIssues = [...new Set(issues)]
  return { ready: uniqueIssues.length === 0, issues: uniqueIssues }
}
