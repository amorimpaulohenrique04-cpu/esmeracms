import type { CollectionConfig } from 'payload'

import { admins, commercialUsers } from '../access/roles'
import { businessUserRelationship } from '../fields/userRelationship'

export const Activities: CollectionConfig = {
  slug: 'activities',
  trash: true,
  labels: { singular: 'Atividade', plural: 'Atividades' },
  admin: {
    group: 'Business',
    useAsTitle: 'summary',
    defaultColumns: ['summary', 'eventType', 'kind', 'occurredAt', 'owner', 'updatedAt'],
    listSearchableFields: ['summary', 'details'],
  },
  access: {
    admin: commercialUsers,
    read: commercialUsers,
    create: commercialUsers,
    update: admins,
    delete: admins,
  },
  fields: [
    {
      name: 'eventType',
      type: 'select',
      label: 'Evento estruturado',
      index: true,
      options: [
        { label: 'Venda criada', value: 'sale.created' },
        { label: 'Etapa da oportunidade alterada', value: 'opportunity.stage_changed' },
        { label: 'Interesse adicionado', value: 'interest.added' },
        { label: 'Follow-up concluído', value: 'followup.completed' },
        { label: 'Entrega realizada', value: 'shipment.delivered' },
        { label: 'Nota criada', value: 'note.created' },
        { label: 'Contato registrado', value: 'contact.logged' },
      ],
    },
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
    businessUserRelationship('owner', 'Responsável'),
    {
      name: 'relatedTo',
      type: 'relationship',
      relationTo: ['leads', 'customers', 'sales', 'after-sales', 'tasks', 'client-interests'],
      hasMany: true,
      label: 'Vínculos',
      required: true,
    },
  ],
}
