import type { CollectionConfig } from 'payload'

import { commercialUsers } from '../access/roles'
import {
  occurrenceSeverities,
  occurrenceSeverityLabels,
  occurrenceStatuses,
  occurrenceStatusLabels,
  occurrenceTypeLabels,
  occurrenceTypes,
} from '../businessRules/afterSales/model'
import { businessUserRelationship } from '../fields/userRelationship'
import { applyOccurrenceRules, recordOccurrenceActivity } from '../hooks/afterSales/applyOccurrenceRules'

export const Occurrences: CollectionConfig = {
  slug: 'occurrences',
  trash: true,
  labels: { singular: 'Ocorrência', plural: 'Ocorrências' },
  admin: {
    group: 'Business',
    useAsTitle: 'description',
    defaultColumns: ['afterSalesCase', 'type', 'severity', 'status', 'owner', 'openedAt'],
    listSearchableFields: ['description', 'resolution'],
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
    beforeValidate: [applyOccurrenceRules],
    afterChange: [recordOccurrenceActivity],
  },
  fields: [
    { name: 'afterSalesCase', type: 'relationship', relationTo: 'after-sales', label: 'Caso de pós-venda', required: true, index: true },
    { name: 'sale', type: 'relationship', relationTo: 'sales', label: 'Venda', required: true, index: true, admin: { readOnly: true } },
    { name: 'customer', type: 'relationship', relationTo: 'customers', label: 'Cliente', required: true, index: true, admin: { readOnly: true } },
    {
      name: 'type',
      type: 'select',
      label: 'Tipo',
      required: true,
      index: true,
      options: occurrenceTypes.map((value) => ({ label: occurrenceTypeLabels[value], value })),
    },
    {
      name: 'severity',
      type: 'select',
      label: 'Severidade',
      required: true,
      defaultValue: 'medium',
      index: true,
      options: occurrenceSeverities.map((value) => ({ label: occurrenceSeverityLabels[value], value })),
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'open',
      index: true,
      options: occurrenceStatuses.map((value) => ({ label: occurrenceStatusLabels[value], value })),
    },
    businessUserRelationship('owner', 'Responsável'),
    { name: 'description', type: 'textarea', label: 'Descrição', required: true },
    { name: 'resolution', type: 'textarea', label: 'Resolução' },
    { name: 'openedAt', type: 'date', label: 'Aberta em', required: true, index: true, admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'closedAt', type: 'date', label: 'Encerrada em', index: true, admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
  ],
}
