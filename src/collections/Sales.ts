import type { CollectionConfig } from 'payload'

import { commercialUsers } from '../access/roles'

export const eligibleSaleStatuses = ['confirmed', 'production', 'ready', 'delivered'] as const

export const Sales: CollectionConfig = {
  slug: 'sales',
  trash: true,
  labels: { singular: 'Venda', plural: 'Vendas' },
  admin: {
    group: 'Business',
    useAsTitle: 'number',
    defaultColumns: ['number', 'customer', 'status', 'totalCents', 'expectedDeliveryAt', 'updatedAt'],
    listSearchableFields: ['number', 'owner'],
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
    beforeChange: [
      ({ data, originalDoc }) => {
        if (!data) return data
        const eligible = eligibleSaleStatuses.includes(data?.status as typeof eligibleSaleStatuses[number])
        if (eligible && !data?.confirmedAt && !originalDoc?.confirmedAt) data.confirmedAt = new Date().toISOString()
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
            { name: 'owner', type: 'text', label: 'Responsável' },
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
                  admin: { description: 'Snapshot obrigatório para preservar o histórico.' },
                },
                { name: 'snapshotSlug', type: 'text', label: 'Slug no momento da venda', required: true },
                { name: 'snapshotSelection', type: 'text', label: 'Seleção no momento da venda' },
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
            { name: 'discountCents', type: 'number', label: 'Desconto em centavos', defaultValue: 0, min: 0 },
            { name: 'shippingCents', type: 'number', label: 'Frete em centavos', defaultValue: 0, min: 0 },
            {
              name: 'totalCents',
              type: 'number',
              label: 'Total fechado em centavos',
              min: 0,
              admin: { description: 'Snapshot financeiro final da venda.' },
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
