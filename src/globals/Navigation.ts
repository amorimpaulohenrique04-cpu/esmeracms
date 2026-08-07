import type { Field, GlobalConfig, Where } from 'payload'

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

function relationID(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' || typeof id === 'number' ? id : null
  }
  return null
}

export const Navigation: GlobalConfig = {
  slug: 'navigation',
  label: 'Navegação',
  admin: { group: 'Site', hidden: ({ user }) => !canManageSite(user) },
  access: { read: publishedGlobalOrAuthenticated, update: siteEditors, readVersions: siteEditors },
  versions: { drafts: true, max: 30 },
  fields: [
    {
      name: 'roots',
      type: 'array',
      label: 'Raízes do menu',
      maxRows: 8,
      admin: {
        description: 'Selecione somente as categorias raiz. Títulos, slugs, filhos e destaques continuam vindo de Categorias.',
      },
      validate: async (value: unknown, { req }) => {
        const rows = Array.isArray(value) ? value : []
        const ids = rows
          .map((row) => row && typeof row === 'object' && 'category' in row ? relationID((row as { category?: unknown }).category) : null)
          .filter((id): id is string | number => id !== null)
        if (ids.length !== rows.length) return 'Toda raiz precisa apontar para uma categoria.'
        if (new Set(ids.map(String)).size !== ids.length) return 'A mesma categoria não pode aparecer duas vezes nas raízes.'
        if (!ids.length) return true

        const where: Where = {
          and: [
            { id: { in: ids } },
            { status: { equals: 'active' } },
            { _status: { equals: 'published' } },
            { 'menu.showInMenu': { equals: true } },
          ],
        }
        const valid = await req.payload.find({
          collection: 'categories',
          depth: 0,
          draft: false,
          limit: Math.max(1, ids.length),
          pagination: false,
          overrideAccess: true,
          req,
          where,
          select: { id: true, parent: true },
        })
        if (valid.docs.length !== ids.length) return 'As raízes precisam estar ativas, publicadas e marcadas para exibição no menu.'
        if (valid.docs.some((category) => relationID(category.parent) !== null)) return 'Somente categorias sem pai podem ser usadas como raiz do menu.'
        return true
      },
      fields: [
        {
          name: 'category',
          type: 'relationship',
          relationTo: 'categories',
          label: 'Categoria raiz',
          required: true,
          filterOptions: {
            and: [
              { parent: { exists: false } },
              { status: { equals: 'active' } },
              { _status: { equals: 'published' } },
              { 'menu.showInMenu': { equals: true } },
            ],
          },
        },
        { name: 'order', type: 'number', label: 'Ordem', min: 0, defaultValue: 100 },
        {
          name: 'desktopMode',
          type: 'select',
          label: 'Desktop',
          defaultValue: 'mega',
          options: [
            { label: 'Mega menu', value: 'mega' },
            { label: 'Link direto', value: 'link' },
          ],
        },
        {
          name: 'mobileMode',
          type: 'select',
          label: 'Mobile',
          defaultValue: 'drilldown',
          options: [
            { label: 'Navegação em níveis', value: 'drilldown' },
            { label: 'Link direto', value: 'link' },
          ],
        },
        { name: 'highlightLimit', type: 'number', label: 'Limite de destaques', min: 0, max: 4, defaultValue: 2 },
      ],
    },
    {
      type: 'collapsible',
      label: 'Compatibilidade temporária V1',
      admin: {
        initCollapsed: true,
        description: 'Mantido somente enquanto o storefront atual migra para o contrato V2.',
      },
      fields: [
        {
          name: 'mainLinks',
          type: 'array',
          label: 'Links principais legados',
          fields: navigationLinkFields(),
        },
        {
          name: 'categoryLinks',
          type: 'relationship',
          relationTo: 'categories',
          hasMany: true,
          label: 'Categorias legadas no submenu',
        },
        { name: 'utilityLinks', type: 'array', label: 'Links utilitários legados', fields: navigationLinkFields() },
      ],
    },
  ],
}
