import { ValidationError, type CollectionBeforeValidateHook } from 'payload'

import { relationshipID, sameRelationship, type RelationshipValue } from '../../businessRules/relationships'
import { calculateSaleFinancials } from '../../businessRules/sales/financials'

type ProductVariant = {
  sku?: string | null
  selection?: Array<{ option?: string | null; value?: string | null }> | null
  priceMode?: 'fixed' | 'inherit' | 'inquiry' | null
  priceCents?: number | null
  status?: string | null
}

type ProductSnapshotSource = {
  id: number | string
  title?: string | null
  slug?: string | null
  priceMode?: 'fixed' | 'inquiry' | null
  basePriceCents?: number | null
  variants?: ProductVariant[] | null
}

type SaleItem = {
  id?: number | string | null
  product?: RelationshipValue
  variantSku?: string | null
  snapshotTitle?: string | null
  snapshotSlug?: string | null
  snapshotSku?: string | null
  snapshotSelection?: string | null
  priceMode?: string | null
  unitPriceCents?: number | null
  quantity?: number | null
}

type SaleData = {
  customer?: RelationshipValue
  items?: SaleItem[] | null
  discountCents?: number | null
  shippingCents?: number | null
  subtotalCents?: number | null
  totalCents?: number | null
  status?: string | null
}

const eligibleStatuses = new Set(['confirmed', 'production', 'ready', 'delivered'])
const validCents = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0

function selectionSnapshot(variant: ProductVariant | undefined) {
  if (!variant?.selection?.length) return null
  return variant.selection
    .map((item) => `${item.option || ''}:${item.value || ''}`)
    .sort()
    .join(' | ')
}

function findOriginalItem(originalItems: SaleItem[], item: SaleItem, index: number) {
  if (item.id !== undefined && item.id !== null) {
    const byID = originalItems.find((candidate) => candidate.id !== undefined && String(candidate.id) === String(item.id))
    if (byID) return byID
  }
  return originalItems[index]
}

export const applySaleRules: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  if (!data) return data
  const id = originalDoc?.id as number | string | undefined
  const incoming = data as SaleData
  const original = (originalDoc || {}) as SaleData
  const items = incoming.items ?? original.items ?? []
  const originalItems = original.items || []
  const errors: Array<{ path: string; message: string }> = []

  if (
    id !== undefined &&
    id !== null &&
    incoming.customer !== undefined &&
    relationshipID(original.customer) !== null &&
    !sameRelationship(incoming.customer, original.customer)
  ) {
    const afterSales = await req.payload.count({
      collection: 'after-sales',
      overrideAccess: true,
      req,
      where: { sale: { equals: id } },
    })
    if (afterSales.totalDocs > 0) {
      errors.push({
        path: 'customer',
        message: 'Não altere o cliente de uma venda que já possui pós-venda. Remova ou ajuste o vínculo primeiro.',
      })
    }
  }

  const normalizedItems = await Promise.all(items.map(async (item, index) => {
    const productID = relationshipID(item.product)
    if (productID === null) {
      errors.push({ path: `items.${index}.product`, message: `O item ${index + 1} precisa de um produto.` })
      return item
    }

    const previous = findOriginalItem(originalItems, item, index)
    const variantSku = item.variantSku ? String(item.variantSku).trim().toUpperCase() : null
    const sourceUnchanged = previous && sameRelationship(previous.product, productID) &&
      String(previous.variantSku || '').toUpperCase() === String(variantSku || '')

    if (sourceUnchanged) {
      const inquiryNegotiatedPrice = previous.priceMode === 'inquiry' && validCents(item.unitPriceCents)
        ? item.unitPriceCents
        : previous.unitPriceCents
      return {
        ...item,
        variantSku,
        snapshotTitle: previous.snapshotTitle,
        snapshotSlug: previous.snapshotSlug,
        snapshotSku: previous.snapshotSku,
        snapshotSelection: previous.snapshotSelection,
        priceMode: previous.priceMode,
        unitPriceCents: inquiryNegotiatedPrice ?? null,
      }
    }

    const product = await req.payload.findByID({
      collection: 'products',
      id: productID,
      depth: 0,
      overrideAccess: true,
      req,
      select: {
        title: true,
        slug: true,
        priceMode: true,
        basePriceCents: true,
        variants: true,
      },
    }) as ProductSnapshotSource

    const variant = variantSku
      ? (product.variants || []).find((candidate) => String(candidate.sku || '').toUpperCase() === variantSku)
      : undefined
    if (variantSku && !variant) {
      errors.push({ path: `items.${index}.variantSku`, message: `O SKU “${variantSku}” não existe no produto selecionado.` })
    }
    if (variant?.status === 'disabled') {
      errors.push({ path: `items.${index}.variantSku`, message: `O SKU “${variantSku}” está desabilitado.` })
    }

    const priceMode = variant?.priceMode === 'fixed' || variant?.priceMode === 'inquiry'
      ? variant.priceMode
      : product.priceMode
    const automaticPrice = variant?.priceMode === 'fixed' ? variant.priceCents : product.basePriceCents
    const unitPriceCents = priceMode === 'fixed'
      ? automaticPrice
      : validCents(item.unitPriceCents) ? item.unitPriceCents : null

    if (priceMode === 'fixed' && !validCents(unitPriceCents)) {
      errors.push({ path: `items.${index}.unitPriceCents`, message: `O item ${index + 1} não possui preço fixo utilizável.` })
    }

    return {
      ...item,
      product: product.id,
      variantSku,
      snapshotTitle: product.title,
      snapshotSlug: product.slug,
      snapshotSku: variant?.sku || null,
      snapshotSelection: selectionSnapshot(variant),
      priceMode,
      unitPriceCents,
    }
  }))

  incoming.items = normalizedItems
  incoming.discountCents = incoming.discountCents ?? original.discountCents ?? 0
  incoming.shippingCents = incoming.shippingCents ?? original.shippingCents ?? 0
  const financials = calculateSaleFinancials(incoming)
  incoming.subtotalCents = financials.subtotalCents
  incoming.totalCents = financials.totalCents
  errors.push(...financials.issues.map((message) => ({ path: 'totalCents', message })))

  const status = incoming.status ?? original.status
  if (status && eligibleStatuses.has(status) && financials.totalCents === null) {
    errors.push({ path: 'status', message: 'Uma venda só pode entrar em estado confirmado quando todos os itens possuem valor fechado.' })
  }

  if (errors.length) {
    throw new ValidationError({ collection: 'sales', id: id ?? undefined, req, errors })
  }

  return data
}
