import type { CollectionConfig, PayloadRequest } from 'payload'

import { commercialUsers } from '../access/roles'

export const eligibleSaleStatuses = ['confirmed', 'production', 'ready', 'delivered'] as const

type RelationValue = string | number | { id?: string | number | null } | null | undefined

type SaleItem = {
  product?: RelationValue
  variantSku?: string | null
  snapshotTitle?: string | null
  snapshotSlug?: string | null
  snapshotSelection?: string | null
  referencePriceCents?: number | null
  priceMode?: 'fixed' | 'inquiry' | string | null
  unitPriceCents?: number | null
  quantity?: number | null
}

type ProductVariant = {
  sku?: string | null
  status?: string | null
  priceMode?: 'inherit' | 'fixed' | 'inquiry' | string | null
  priceCents?: number | null
  selection?: Array<{ option?: string | null; value?: string | null }> | null
}

type ProductDocument = {
  title?: string | null
  slug?: string | null
  priceMode?: 'fixed' | 'inquiry' | string | null
  basePriceCents?: number | null
  optionDefinitions?: Array<{
    code?: string | null
    label?: string | null
    values?: Array<{ value?: string | null; label?: string | null }> | null
  }> | null
  variants?: ProductVariant[] | null
}

function relationId(value: RelationValue) {
  if (value && typeof value === 'object') return value.id ?? null
  return value ?? null
}

function selectionLabel(product: ProductDocument, variant?: ProductVariant) {
  if (!variant?.selection?.length) return null
  const definitions = new Map(
    (product.optionDefinitions || []).map((definition) => [definition.code, definition]),
  )
  return variant.selection
    .map((selection) => {
      const definition = definitions.get(selection.option)
      const value = definition?.values?.find((entry) => entry.value === selection.value)
      return `${definition?.label || selection.option || 'Opção'}: ${value?.label || selection.value || '—'}`
    })
    .join(' · ')
}

async function hydrateSaleItem(item: SaleItem, req: PayloadRequest): Promise<SaleItem> {
  const productId = relationId(item.product)
  if (!productId) return item

  const product = (await req.payload.findByID({
    collection: 'products',
    id: productId,
    depth: 0,
    overrideAccess: false,
    req,
  })) as ProductDocument

  const variant = item.variantSku
    ? product.variants?.find((entry) => entry.sku === item.variantSku && entry.status !== 'disabled')
    : undefined

  if (item.variantSku && !variant) {
    throw new Error(`A variante ${item.variantSku} não existe ou está desabilitada no produto selecionado.`)
  }

  const variantMode = variant?.priceMode
  const referenceMode = variantMode === 'inherit' || !variantMode ? product.priceMode : variantMode
  const referencePrice =
    variantMode === 'fixed' && typeof variant?.priceCents === 'number'
      ? variant.priceCents
      : referenceMode === 'fixed' && typeof product.basePriceCents === 'number'
        ? product.basePriceCents
        : null

  return {
    ...item,
    snapshotTitle: String(product.title || '').trim(),
    snapshotSlug: String(product.slug || '').trim(),
    snapshotSelection: selectionLabel(product, variant),
    referencePriceCents: referencePrice,
    priceMode: item.priceMode || referenceMode || 'inquiry',
    unitPriceCents:
      typeof item.unitPriceCents === 'number'
        ? item.unitPriceCents
        : referenceMode === 'fixed'
          ? referencePrice
          : null,
  }
}

function calculateFinancials(data: Record<string, unknown>) {
  const items = (Array.isArray(data.items) ? data.items : []) as SaleItem[]
  const discount = typeof data.discountCents === 'number' ? data.discountCents : 0
  const shipping = typeof data.shippingCents === 'number' ? data.shippingCents : 0
  const override = typeof data.totalOverrideCents === 'number' ? data.totalOverrideCents : null
  const reason = String(data.totalOverrideReason || '').trim()

  if (override !== null) {
    if (!reason) throw new Error('Informe o motivo do total negociado manualmente.')
    data.subtotalCents = items.reduce(
      (sum, item) =>
        sum + (item.priceMode === 'fixed' && typeof item.unitPriceCents === 'number' ? item.unitPriceCents * Math.max(1, Number(item.quantity || 1)) : 0),
      0,
    )
    data.totalCents = override
    return
  }

  const hasUnpricedItem = items.some(
    (item) => item.priceMode !== 'fixed' || typeof item.unitPriceCents !== 'number',
  )
  if (hasUnpricedItem) {
    data.subtotalCents = null
    data.totalCents = null
    return
  }

  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.unitPriceCents || 0) * Math.max(1, Number(item.quantity || 1)),
    0,
  )
  const total = subtotal - discount + shipping
  if (total < 0) throw new Error('O total da venda não pode ser negativo.')
  data.subtotalCents = subtotal
  data.totalCents = total
}

export const Sales: CollectionConfig = {
  slug: 'sales',
  trash: true,
  labels: { singular: 'Venda', plural: 'Vendas' },
  admin: {
    group: 'Business',
    useAsTitle: 'number',
    defaultColumns: ['number', 'customer', 'status', 'totalCents', 'expectedDeliveryAt', 'updatedAt'],
    listSearchableFields: ['number'],
  },
  access: {
    read: commercialUsers,
    create: commercialUsers,
    update: commercialUsers,
    delete: commercialUsers,
    readVersions: commercialUsers,
  },
  versions: { maxPerDoc: 100 },
  hooks: {
    beforeValidate: [
      async ({ data, originalDoc, req }) => {
        if (!data) return data
        const next = { ...(originalDoc || {}), ...data } as Record<string, unknown>
        if (Array.isArray(next.items)) {
          next.items = await Promise.all((next.items as SaleItem[]).map((item) => hydrateSaleItem(item, req)))
          data.items = next.items
        }
        calculateFinancials(next)
        data.subtotalCents = next.subtotalCents
        data.totalCents = next.totalCents
        return data
      },
    ],
    beforeChange: [
      ({ data, originalDoc }) => {
        if (!data) return data
        const nextStatus = data.status ?? originalDoc?.status
        const eligible = eligibleSaleStatuses.includes(nextStatus as typeof eligibleSaleStatuses[number])
        if (eligible && !data?.confirmedAt && !originalDoc?.confirmedAt) data.confirmedAt = new Date().toISOString()
        const total = data.totalCents ?? originalDoc?.totalCents
        if (eligible && typeof total !== 'number') {
          throw new Error('Uma venda confirmada precisa ter total calculável ou override financeiro com motivo.')
        }
        return data
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Venda',
          fields: [
            { name: 'number', type: 'text', label: 'Número', required: true, unique: true, index: true },
            { name: 'customer', type: 'relationship', relationTo: 'customers', label: 'Cliente', required: true },
            {
              name: 'channel',
              type: 'select',
              label: 'Canal',
              required: true,
              defaultValue: 'whatsapp',
              options: [
                { label: 'WhatsApp', value: 'whatsapp' },
                { label: 'Instagram', value: 'instagram' },
                { label: 'Site', value: 'site' },
                { label: 'Indicação', value: 'referral' },
                { label: 'Arquiteto', value: 'architect' },
                { label: 'Outro', value: 'other' },
              ],
            },
            {
              name: 'status',
              type: 'select',
              label: 'Status',
              required: true,
              defaultValue: 'draft',
              index: true,
              options: [
                { label: 'Rascunho', value: 'draft' },
                { label: 'Proposta enviada', value: 'proposal' },
                { label: 'Negociação', value: 'negotiation' },
                { label: 'Confirmada', value: 'confirmed' },
                { label: 'Em produção', value: 'production' },
                { label: 'Pronta para entrega', value: 'ready' },
                { label: 'Entregue', value: 'delivered' },
                { label: 'Cancelada', value: 'cancelled' },
              ],
            },
            {
              name: 'ownerUser',
              type: 'relationship',
              relationTo: 'users',
              label: 'Responsável',
              index: true,
              filterOptions: {
                or: [{ role: { equals: 'admin' } }, { role: { equals: 'commercial' } }],
              },
            },
            {
              name: 'owner',
              type: 'text',
              label: 'Responsável legado',
              admin: { hidden: true, description: 'Campo temporário para migração dos registros anteriores ao relacionamento com Users.' },
            },
            {
              name: 'confirmedAt',
              type: 'date',
              label: 'Venda confirmada em',
              index: true,
              admin: { readOnly: true, position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } },
            },
            { name: 'nextAction', type: 'text', label: 'Próxima ação' },
            { name: 'nextActionAt', type: 'date', label: 'Prazo da próxima ação', admin: { date: { pickerAppearance: 'dayAndTime' } } },
          ],
        },
        {
          label: 'Itens e valores',
          fields: [
            {
              name: 'items',
              type: 'array',
              label: 'Itens',
              required: true,
              minRows: 1,
              fields: [
                { name: 'product', type: 'relationship', relationTo: 'products', label: 'Produto do catálogo', required: true },
                { name: 'variantSku', type: 'text', label: 'Código da variante' },
                {
                  name: 'snapshotTitle',
                  type: 'text',
                  label: 'Nome no momento da venda',
                  required: true,
                  admin: { readOnly: true, description: 'Preenchido automaticamente a partir do produto.' },
                },
                { name: 'snapshotSlug', type: 'text', label: 'Slug no momento da venda', required: true, admin: { readOnly: true } },
                { name: 'snapshotSelection', type: 'text', label: 'Seleção no momento da venda', admin: { readOnly: true } },
                { name: 'referencePriceCents', type: 'number', label: 'Preço de referência em centavos', admin: { readOnly: true } },
                {
                  name: 'priceMode',
                  type: 'select',
                  label: 'Modo de preço',
                  required: true,
                  options: [
                    { label: 'Preço fixo', value: 'fixed' },
                    { label: 'Sob consulta', value: 'inquiry' },
                  ],
                },
                {
                  name: 'unitPriceCents',
                  type: 'number',
                  label: 'Valor unitário em centavos',
                  min: 0,
                  admin: { condition: (_, siblingData) => siblingData?.priceMode === 'fixed' },
                },
                { name: 'quantity', type: 'number', label: 'Quantidade', required: true, defaultValue: 1, min: 1, admin: { step: 1 } },
              ],
            },
            { name: 'subtotalCents', type: 'number', label: 'Subtotal em centavos', admin: { readOnly: true } },
            { name: 'discountCents', type: 'number', label: 'Desconto em centavos', defaultValue: 0, min: 0 },
            { name: 'shippingCents', type: 'number', label: 'Frete em centavos', defaultValue: 0, min: 0 },
            {
              name: 'totalOverrideCents',
              type: 'number',
              label: 'Total negociado manualmente em centavos',
              min: 0,
              admin: { description: 'Use apenas em negociação especial ou item sob consulta. Exige justificativa.' },
            },
            {
              name: 'totalOverrideReason',
              type: 'textarea',
              label: 'Motivo do total negociado',
              admin: { condition: (_, siblingData) => typeof siblingData?.totalOverrideCents === 'number' },
            },
            {
              name: 'totalCents',
              type: 'number',
              label: 'Total final em centavos',
              min: 0,
              admin: { readOnly: true, description: 'Calculado no servidor a partir dos itens, desconto, frete e eventual override justificado.' },
            },
          ],
        },
        {
          label: 'Entrega',
          fields: [
            { name: 'expectedDeliveryAt', type: 'date', label: 'Entrega prevista', admin: { date: { pickerAppearance: 'dayAndTime' } } },
            { name: 'deliveredAt', type: 'date', label: 'Entrega realizada', admin: { date: { pickerAppearance: 'dayAndTime' } } },
            {
              name: 'deliveryMode',
              type: 'select',
              label: 'Forma de entrega',
              options: [
                { label: 'Transportadora', value: 'carrier' },
                { label: 'Retirada', value: 'pickup' },
                { label: 'Entrega própria', value: 'own_delivery' },
              ],
            },
            { name: 'deliveryNotes', type: 'textarea', label: 'Observações da entrega' },
          ],
        },
      ],
    },
  ],
}
