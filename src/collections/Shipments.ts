import type { CollectionConfig } from 'payload'

import { commercialUsers } from '../access/roles'
import { shipmentStatusLabels, shipmentStatuses } from '../businessRules/afterSales/model'
import { applyShipmentRules, recordShipmentActivity } from '../hooks/afterSales/applyShipmentRules'

export const Shipments: CollectionConfig = {
  slug: 'shipments',
  trash: true,
  labels: { singular: 'Entrega', plural: 'Entregas' },
  admin: {
    group: 'Business',
    useAsTitle: 'trackingCode',
    defaultColumns: ['afterSalesCase', 'carrier', 'trackingCode', 'status', 'estimatedDelivery', 'updatedAt'],
    listSearchableFields: ['carrier', 'trackingCode', 'lastEvent'],
  },
  access: {
    admin: commercialUsers,
    read: commercialUsers,
    create: commercialUsers,
    update: commercialUsers,
    delete: commercialUsers,
    readVersions: commercialUsers,
  },
  versions: { maxPerDoc: 50 },
  hooks: {
    beforeValidate: [applyShipmentRules],
    afterChange: [recordShipmentActivity],
  },
  fields: [
    { name: 'afterSalesCase', type: 'relationship', relationTo: 'after-sales', label: 'Caso de pós-venda', required: true, index: true },
    { name: 'sale', type: 'relationship', relationTo: 'sales', label: 'Venda', required: true, index: true, admin: { readOnly: true } },
    { name: 'customer', type: 'relationship', relationTo: 'customers', label: 'Cliente', required: true, index: true, admin: { readOnly: true } },
    { name: 'carrier', type: 'text', label: 'Transportadora ou responsável' },
    { name: 'trackingCode', type: 'text', label: 'Código de rastreio', index: true },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'confirmed',
      index: true,
      options: shipmentStatuses.map((value) => ({ label: shipmentStatusLabels[value], value })),
    },
    { name: 'estimatedDelivery', type: 'date', label: 'Entrega prevista', index: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'deliveredAt', type: 'date', label: 'Entregue em', index: true, admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'lastEvent', type: 'textarea', label: 'Último evento real' },
    { name: 'notes', type: 'textarea', label: 'Observações' },
  ],
}
