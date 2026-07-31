import type { CollectionConfig } from 'payload'

import { activeCategoriesOrAuthenticated, siteEditors } from '../access/roles'
import { seoField, slugify } from '../fields/common'

export const Categories: CollectionConfig = {
  slug: 'categories',
  trash: true,
  labels: {
    singular: 'Categoria',
    plural: 'Categorias',
  },
  admin: {
    group: 'Site',
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'parent', 'order', 'updatedAt'],
  },
  access: {
    read: activeCategoriesOrAuthenticated,
    create: siteEditors,
    update: siteEditors,
    delete: siteEditors,
    readVersions: siteEditors,
  },
  versions: {
    drafts: true,
    maxPerDoc: 30,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (data?.title && !data.slug) data.slug = slugify(String(data.title))
        return data
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Categoria',
          fields: [
            {
              name: 'title',
              type: 'text',
              label: 'Nome',
              required: true,
              unique: true,
            },
            {
              name: 'slug',
              type: 'text',
              label: 'Slug',
              required: true,
              unique: true,
              index: true,
              validate: (value: unknown) =>
                /^[a-z0-9-]+$/.test(String(value || '')) || 'Use letras minúsculas, números e hífens.',
            },
            {
              name: 'status',
              type: 'select',
              label: 'Status',
              required: true,
              defaultValue: 'active',
              options: [
                { label: 'Ativa', value: 'active' },
                { label: 'Arquivada', value: 'archive' },
              ],
            },
            {
              name: 'parent',
              type: 'relationship',
              relationTo: 'categories',
              label: 'Categoria principal',
            },
            {
              name: 'description',
              type: 'textarea',
              label: 'Descrição',
            },
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              label: 'Imagem',
            },
            {
              name: 'order',
              type: 'number',
              label: 'Ordem editorial',
              defaultValue: 100,
              min: 0,
              admin: { step: 1 },
            },
          ],
        },
        {
          label: 'Descoberta',
          fields: [
            {
              name: 'searchTerms',
              type: 'array',
              label: 'Sinônimos de busca',
              fields: [{ name: 'term', type: 'text', label: 'Termo', required: true }],
            },
            seoField(),
          ],
        },
      ],
    },
  ],
}
