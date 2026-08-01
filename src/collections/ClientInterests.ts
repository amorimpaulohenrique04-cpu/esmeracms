import type { CollectionConfig } from 'payload'

import { commercialUsers } from '../access/roles'
import { businessUserRelationship } from '../fields/userRelationship'

export const ClientInterests: CollectionConfig = {
  slug: 'client-interests',
  trash: true,
  labels: { singular: 'Interesse de cliente', plural: 'Interesses de clientes' },
  admin: {
    group: 'Business',
    useAsTitle: 'id',
    defaultColumns: ['customer', 'product', 'status', 'source', 'owner', 'updatedAt'],
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
  fields: [
    { name: 'customer', type: 'relationship', relationTo: 'customers', label: 'Cliente', required: true, index: true },
    { name: 'product', type: 'relationship', relationTo: 'products', label: 'Produto', required: true, index: true },
    {
      name: 'status',
      type: 'select',
      label: 'Status do interesse',
      required: true,
      defaultValue: 'active',
      index: true,
      options: [
        { label: 'Ativo', value: 'active' },
        { label: 'Em curadoria', value: 'curation' },
        { label: 'Convertido em compra', value: 'purchased' },
        { label: 'Pausado', value: 'paused' },
        { label: 'Arquivado', value: 'archived' },
      ],
    },
    {
      name: 'source',
      type: 'select',
      label: 'Origem do interesse',
      required: true,
      defaultValue: 'manual',
      options: [
        { label: 'Registro manual', value: 'manual' },
        { label: 'Lead', value: 'lead' },
        { label: 'Venda', value: 'sale' },
        { label: 'Pós-venda', value: 'after_sale' },
      ],
    },
    businessUserRelationship('owner', 'Responsável'),
    { name: 'notes', type: 'textarea', label: 'Contexto do interesse' },
    {
      name: 'addedAt',
      type: 'date',
      label: 'Adicionado em',
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'closedAt',
      type: 'date',
      label: 'Encerrado em',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
  ],
}
