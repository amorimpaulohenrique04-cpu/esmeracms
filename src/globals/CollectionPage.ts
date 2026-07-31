import type { GlobalConfig } from 'payload'

import { publishedGlobalOrAuthenticated, siteEditors } from '../access/roles'
import { callToActionFields, seoField } from '../fields/common'

export const CollectionPage: GlobalConfig = {
  slug: 'collection-page',
  label: 'Coleção',
  admin: { group: 'Site' },
  access: { read: publishedGlobalOrAuthenticated, update: siteEditors, readVersions: siteEditors },
  versions: { drafts: true, max: 30 },
  fields: [
    { name: 'title', type: 'text', label: 'Título', required: true },
    { name: 'intro', type: 'richText', label: 'Introdução' },
    {
      name: 'visibleFilters',
      type: 'select',
      hasMany: true,
      label: 'Filtros visíveis',
      options: [
        { label: 'Categoria', value: 'category' },
        { label: 'Material', value: 'material' },
        { label: 'Disponibilidade', value: 'availability' },
        { label: 'Preço', value: 'price' },
      ],
    },
    { name: 'allLabel', type: 'text', label: 'Rótulo para todos', defaultValue: 'Todos' },
    { name: 'inquiryLabel', type: 'text', label: 'Rótulo para preço sob consulta', defaultValue: 'Sob consulta' },
    { name: 'emptyStateTitle', type: 'text', label: 'Título quando não houver resultados', required: true },
    { name: 'emptyStateCopy', type: 'textarea', label: 'Texto quando não houver resultados' },
    callToActionFields('emptyStateCallToAction', 'Ação alternativa'),
    seoField(),
  ],
}
