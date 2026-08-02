import type { CollectionConfig } from 'payload'

import { commercialUsers } from '../access/roles'
import { businessUserRelationship } from '../fields/userRelationship'
import { applySaleRules } from '../hooks/sales/applySaleRules'
import { VALID_SALE_STATUSES } from '../server/reporting/metrics'
import { scheduleSaleJobs } from '../server/jobs'

export const eligibleSaleStatuses = VALID_SALE_STATUSES

export const Sales: CollectionConfig = {
  slug: 'sales',
  trash: true,
  labels: { singular: 'Venda', plural: 'Vendas' },
  admin: {
    group: 'Business',
    useAsTitle: 'number',
    defaultColumns: ['number', 'customer', 'opportunity', 'status', 'totalCents', 'expectedDeliveryAt', 'updatedAt'],
    listSearchableFields: ['number'],
    description: 'Sale representa a transação ganha e seu fulfillment. Negociação comercial pertence a Opportunities.',
  },
  access: {
    admin: commercialUsers,
    read: commercialUsers,
    create: commercialUsers,
    update: commercialUsers,
    delete: commercialUsers,
    readVersions: commercialUsers,
  },
  versions: { maxPerDoc: 100 },
  hooks: {
    beforeValidate: [applySaleRules],
    beforeChange: [
      ({ data, originalDoc }) => {
        if (!data) return data
        const status = data.status ?? originalDoc?.status
        const totalCents = data.totalCents ?? originalDoc?.totalCents
        const eligible = eligibleSaleStatuses.includes(status as typeof eligibleSaleStatuses[number])
        if (originalDoc?.confirmedAt) data.confirmedAt = originalDoc.confirmedAt
        else if (eligible && typeof totalCents === 'number') data.confirmedAt = new Date().toISOString()
        else data.confirmedAt = null
        return data
      },
    ],
    afterChange: [scheduleSaleJobs],
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
              name: 'opportunity',
              type: 'relationship',
              relationTo: 'opportunities',
              label: 'Oportunidade de origem',
              unique: true,
              index: true,
              admin: { description: 'Preenchida pelo workflow de ganho ou vinculada explicitamente em vendas legadas.' },
            },
            {
              name: 'channel',
              type: 'select',
              label: 'Canal',
              required: true,
              defaultValue: 'whatsapp',
              index: true,
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
                { label: 'Proposta enviada (legado)', value: 'proposal' },
                { label: 'Negociação (legado)', value: 'negotiation' },
                { label: 'Confirmada', value: 'confirmed' },
                { label: 'Em produção', value: 'production' },
                { label: 'Pronta para entrega', value: 'ready' },
                { label: 'Entregue', value: 'delivered' },
                { label: 'Cancelada', value: 'cancelled' },
              ],
            },
            {
              ...businessUserRelationship('owner', 'Responsável'),
              index: true,
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
                { name: 'snapshotSku', type: 'text', label: 'SKU no momento da venda', admin: { readOnly: true } },
                { name: 'snapshotSelection', type: 'text', label: 'Seleção no momento da venda', admin: { readOnly: true } },
                {
                  name: 'priceMode',
                  type: 'select',
                  label: 'Modo de preço',
                  required: true,
                  admin: { readOnly: true },
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
                  admin: {
                    description: 'Automático para preço fixo. Em itens sob consulta, informe apenas após o valor ser negociado.',
                  },
                },
                { name: 'quantity', type: 'number', label: 'Quantidade', required: true, defaultValue: 1, min: 1, admin: { step: 1 } },
              ],
            },
            { name: 'discountCents', type: 'number', label: 'Desconto em centavos', defaultValue: 0, min: 0 },
            { name: 'shippingCents', type: 'number', label: 'Frete em centavos', defaultValue: 0, min: 0 },
            {
              name: 'subtotalCents',
              type: 'number',
              label: 'Subtotal em centavos',
              min: 0,
              admin: { readOnly: true },
            },
            {
              name: 'totalCents',
              type: 'number',
              label: 'Total fechado em centavos',
              min: 0,
              admin: { readOnly: true, description: 'Calculado automaticamente a partir dos itens, desconto e frete.' },
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
