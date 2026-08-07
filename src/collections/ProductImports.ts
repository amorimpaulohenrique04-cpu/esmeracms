import type { CollectionConfig } from 'payload'

import { admins, isAdmin, siteEditors } from '../access/roles'

export const ProductImports: CollectionConfig = {
  slug: 'product-imports',
  labels: {
    singular: 'Importação de produtos',
    plural: 'Importações de produtos',
  },
  admin: {
    group: 'Admin técnico',
    useAsTitle: 'idempotencyKey',
    defaultColumns: ['status', 'totalRows', 'processedRows', 'created', 'updated', 'errored', 'requestedAt'],
    hidden: ({ user }) => !isAdmin(user),
  },
  access: {
    admin: siteEditors,
    read: siteEditors,
    create: () => false,
    update: () => false,
    delete: admins,
  },
  fields: [
    {
      name: 'status',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Na fila', value: 'queued' },
        { label: 'Processando', value: 'processing' },
        { label: 'Concluída', value: 'completed' },
        { label: 'Concluída com erros', value: 'completed_with_errors' },
        { label: 'Falhou', value: 'failed' },
        { label: 'Cancelada', value: 'cancelled' },
      ],
    },
    { name: 'idempotencyKey', type: 'text', required: true, unique: true, index: true },
    { name: 'requestedBy', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'requestedByName', type: 'text' },
    { name: 'requestedByEmail', type: 'email' },
    { name: 'requestedAt', type: 'date', required: true, index: true },
    { name: 'startedAt', type: 'date' },
    { name: 'completedAt', type: 'date' },
    { name: 'totalRows', type: 'number', required: true, min: 0 },
    { name: 'processedRows', type: 'number', required: true, defaultValue: 0, min: 0 },
    { name: 'created', type: 'number', required: true, defaultValue: 0, min: 0 },
    { name: 'updated', type: 'number', required: true, defaultValue: 0, min: 0 },
    { name: 'skipped', type: 'number', required: true, defaultValue: 0, min: 0 },
    { name: 'errored', type: 'number', required: true, defaultValue: 0, min: 0 },
    { name: 'payloadSnapshot', type: 'json', required: true },
    { name: 'results', type: 'json' },
    { name: 'error', type: 'textarea', maxLength: 4000 },
  ],
}
