import type { CollectionConfig } from 'payload'

import { admins, commercialUsers, isAdmin } from '../access/roles'

export const ReportExports: CollectionConfig = {
  slug: 'report-exports',
  labels: {
    singular: 'Exportação de relatório',
    plural: 'Exportações de relatórios',
  },
  admin: {
    group: 'Admin técnico',
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'status', 'delivery', 'semanticVersion', 'requestedByName', 'requestedAt'],
    hidden: ({ user }) => !isAdmin(user),
  },
  access: {
    admin: commercialUsers,
    read: commercialUsers,
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
        { label: 'Pronto', value: 'ready' },
        { label: 'Falhou', value: 'failed' },
      ],
    },
    {
      name: 'delivery',
      type: 'select',
      required: true,
      options: [
        { label: 'Síncrono', value: 'sync' },
        { label: 'Jobs Queue', value: 'job' },
      ],
    },
    { name: 'requestedAt', type: 'date', required: true, index: true },
    { name: 'startedAt', type: 'date' },
    { name: 'completedAt', type: 'date' },
    {
      name: 'requestedBy',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    { name: 'requestedByName', type: 'text', required: true },
    { name: 'requestedByEmail', type: 'email' },
    { name: 'filename', type: 'text', required: true },
    { name: 'semanticVersion', type: 'text', required: true, index: true },
    { name: 'snapshotGeneratedAt', type: 'date' },
    { name: 'filters', type: 'json', required: true },
    { name: 'estimatedRows', type: 'number', min: 0 },
    { name: 'fileSizeBytes', type: 'number', min: 0 },
    {
      name: 'file',
      type: 'relationship',
      relationTo: 'report-export-files',
    },
    { name: 'error', type: 'textarea' },
  ],
}
