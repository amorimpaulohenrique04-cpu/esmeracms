import path from 'path'
import type { CollectionConfig } from 'payload'

import { admins, commercialUsers, isAdmin } from '../access/roles'

export const ReportExportFiles: CollectionConfig = {
  slug: 'report-export-files',
  labels: {
    singular: 'Arquivo de relatório',
    plural: 'Arquivos de relatórios',
  },
  admin: {
    group: 'Admin técnico',
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'semanticVersion', 'createdAt'],
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
    { name: 'semanticVersion', type: 'text', required: true },
    { name: 'generatedAt', type: 'date', required: true },
  ],
  upload: {
    staticDir: path.resolve(process.cwd(), 'report-exports'),
    mimeTypes: ['application/pdf'],
  },
}
