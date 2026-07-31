import type { CollectionConfig } from 'payload'

import { commercialUsers } from '../access/roles'

export const Tasks: CollectionConfig = {
  slug: 'tasks',
  trash: true,
  labels: { singular: 'Tarefa', plural: 'Tarefas' },
  admin: {
    group: 'Business',
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'priority', 'dueAt', 'assignee', 'updatedAt'],
  },
  access: {
    read: commercialUsers,
    create: commercialUsers,
    update: commercialUsers,
    delete: commercialUsers,
    readVersions: commercialUsers,
  },
  versions: { maxPerDoc: 30 },
  fields: [
    { name: 'title', type: 'text', label: 'Tarefa', required: true },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'pending',
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
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    { name: 'assignee', type: 'text', label: 'Responsável' },
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
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
  ],
}
