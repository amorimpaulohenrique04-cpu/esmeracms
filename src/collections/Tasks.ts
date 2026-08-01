import type { CollectionConfig } from 'payload'

import { commercialUsers } from '../access/roles'
import {
  operationalPriorities,
  operationalPriorityLabels,
  taskStatuses,
  taskStatusLabels,
  taskTypeLabels,
  taskTypes,
} from '../businessRules/afterSales/model'
import { businessUserRelationship } from '../fields/userRelationship'
import { applyTaskRules } from '../hooks/tasks/applyTaskRules'
import { recordTaskActivity } from '../hooks/tasks/recordTaskActivity'

export const Tasks: CollectionConfig = {
  slug: 'tasks',
  trash: true,
  labels: { singular: 'Tarefa', plural: 'Tarefas' },
  admin: {
    group: 'Business',
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'status', 'priority', 'dueAt', 'assignee', 'updatedAt'],
    listSearchableFields: ['title', 'notes'],
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
    beforeChange: [applyTaskRules],
    afterChange: [recordTaskActivity],
  },
  fields: [
    { name: 'title', type: 'text', label: 'Tarefa', required: true },
    {
      name: 'type',
      type: 'select',
      label: 'Tipo',
      required: true,
      defaultValue: 'custom',
      index: true,
      options: taskTypes.map((value) => ({ label: taskTypeLabels[value], value })),
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: taskStatuses.map((value) => ({ label: taskStatusLabels[value], value })),
    },
    {
      name: 'priority',
      type: 'select',
      label: 'Prioridade',
      required: true,
      defaultValue: 'normal',
      index: true,
      options: operationalPriorities.map((value) => ({ label: operationalPriorityLabels[value], value })),
    },
    {
      name: 'dueAt',
      type: 'date',
      label: 'Prazo',
      required: true,
      index: true,
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    businessUserRelationship('assignee', 'Responsável'),
    {
      name: 'relatedTo',
      type: 'relationship',
      relationTo: ['leads', 'customers', 'opportunities', 'sales', 'after-sales', 'shipments', 'occurrences'],
      hasMany: true,
      label: 'Vínculos',
      required: true,
    },
    { name: 'notes', type: 'textarea', label: 'Observações' },
    {
      name: 'completedAt',
      type: 'date',
      label: 'Concluída em',
      admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'legacySourceKey',
      type: 'text',
      label: 'Chave de migração legada',
      unique: true,
      index: true,
      admin: { hidden: true, readOnly: true },
    },
  ],
}
