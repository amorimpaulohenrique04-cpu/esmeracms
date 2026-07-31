import type { CollectionConfig } from 'payload'

import { commercialUsers } from '../access/roles'

export const Tasks: CollectionConfig = {
  slug: 'tasks',
  trash: true,
  labels: { singular: 'Tarefa', plural: 'Tarefas' },
  admin: {
    group: 'Business',
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'priority', 'dueAt', 'assigneeUser', 'updatedAt'],
  },
  access: {
    read: commercialUsers,
    create: commercialUsers,
    update: commercialUsers,
    delete: commercialUsers,
    readVersions: commercialUsers,
  },
  versions: { maxPerDoc: 30 },
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        if (!data) return data
        const nextStatus = data.status ?? originalDoc?.status
        const changed = data.status !== undefined && data.status !== originalDoc?.status
        if (nextStatus === 'done' && (!originalDoc?.completedAt || changed)) {
          data.completedAt = new Date().toISOString()
        }
        if (nextStatus !== 'done' && changed && originalDoc?.completedAt) {
          data.completedAt = null
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', label: 'Tarefa', required: true },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Pendente', value: 'pending' },
        { label: 'Em andamento', value: 'in_progress' },
        { label: 'Concluída', value: 'done' },
        { label: 'Cancelada', value: 'cancelled' },
      ],
    },
    {
      name: 'priority',
      type: 'select',
      label: 'Prioridade',
      required: true,
      defaultValue: 'normal',
      options: [
        { label: 'Baixa', value: 'low' },
        { label: 'Normal', value: 'normal' },
        { label: 'Alta', value: 'high' },
        { label: 'Urgente', value: 'urgent' },
      ],
    },
    {
      name: 'dueAt',
      type: 'date',
      label: 'Prazo',
      required: true,
      index: true,
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'assigneeUser',
      type: 'relationship',
      relationTo: 'users',
      label: 'Responsável',
      index: true,
      filterOptions: {
        or: [{ role: { equals: 'admin' } }, { role: { equals: 'commercial' } }],
      },
    },
    {
      name: 'assignee',
      type: 'text',
      label: 'Responsável legado',
      admin: { hidden: true, description: 'Compatibilidade temporária até a migração dos valores antigos para Users.' },
    },
    {
      name: 'relatedTo',
      type: 'relationship',
      relationTo: ['leads', 'customers', 'sales', 'after-sales'],
      hasMany: true,
      label: 'Vínculos',
    },
    { name: 'notes', type: 'textarea', label: 'Observações' },
    {
      name: 'completedAt',
      type: 'date',
      label: 'Concluída em',
      admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
  ],
}
