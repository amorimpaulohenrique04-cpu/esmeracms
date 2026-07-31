import type { Field, GlobalConfig } from 'payload'

import { canManageSite, publishedGlobalOrAuthenticated, siteEditors } from '../access/roles'

const navigationLinkFields = (): Field[] => [
  { name: 'label', type: 'text' as const, label: 'Nome', required: true, maxLength: 40 },
  {
    name: 'path',
    type: 'text' as const,
    label: 'Destino',
    required: true,
    validate: (value: unknown) => /^\/(?:[a-z0-9-]+\/?)*$/.test(String(value || '')) || 'Use / ou /nome-da-pagina.',
  },
  { name: 'active', type: 'checkbox' as const, label: 'Ativo', defaultValue: true },
]

export const Navigation: GlobalConfig = {
  slug: 'navigation',
  label: 'Navegação',
  admin: { group: 'Site', hidden: ({ user }) => !canManageSite(user) },
  access: { read: publishedGlobalOrAuthenticated, update: siteEditors, readVersions: siteEditors },
  versions: { drafts: true, max: 30 },
  fields: [
    { name: 'mainLinks', type: 'array', label: 'Links principais', required: true, minRows: 1, fields: navigationLinkFields() },
    { name: 'categoryLinks', type: 'relationship', relationTo: 'categories', hasMany: true, label: 'Categorias no submenu' },
    { name: 'utilityLinks', type: 'array', label: 'Links utilitários', fields: navigationLinkFields() },
  ],
}
