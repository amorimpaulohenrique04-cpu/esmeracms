import type { CollectionConfig } from 'payload'

import { admins, commercialUsers } from '../access/roles'

export const Activities: CollectionConfig = {
  slug: 'activities',
  trash: true,
  labels: { singular: 'Atividade', plural: 'Atividades' },
  admin: {
    group: 'Business',
    useAsTitle: 'summary',
    defaultColumns: ['summary', 'kind', 'occurredAt', 'owner', 'updatedAt'],
    listSearchableFields: ['summary', 'details', 'owner'],
  },
  access: {
    read: commercialUsers,
    create: commercialUsers,
    update: commercialUsers,
    delete: admins,
  },
  fields: [
    {
      name: 'kind',
      type: 'select',
      label: 'Tipo',
      required: true,
      options: [
        { label: 'Contato', value: 'contact' },
        { label: 'Mensagem', value: 'message' },
        { label: 'Proposta', value: 'proposal' },
        { label: 'Mudança de etapa', value: 'stage_change' },
        { label: 'Nota', value: 'note' },
        { label: 'Entrega', value: 'delivery' },
        { label: 'Follow-up', value: 'follow_up' },
      ],
    },
    {
      name: 'occurredAt',
      type: 'date',
      label: 'Data e hora',
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    { name: 'summary', type: 'text', label: 'Resumo', required: true },
    { name: 'details', type: 'textarea', label: 'Detalhes' },
    { name: 'owner', type: 'text', label: 'Responsável' },
    {
      name: 'relatedTo',
      type: 'relationship',
      relationTo: ['leads', 'customers', 'sales', 'after-sales', 'tasks'],
      hasMany: true,
      label: 'Vínculos',
      required: true,
    },
  ],
}
