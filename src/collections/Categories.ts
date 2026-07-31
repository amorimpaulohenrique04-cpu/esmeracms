import type { CollectionConfig } from 'payload'

import { activeCategoriesOrAuthenticated, siteEditors } from '../access/roles'
import { seoField, slugify } from '../fields/common'

type RelationValue = string | number | { id?: string | number | null } | null | undefined

function relationId(value: RelationValue) {
  if (value && typeof value === 'object') return value.id ?? null
  return value ?? null
}

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
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        const currentId = relationId(originalDoc?.id as RelationValue)
        const parentValue = data?.parent !== undefined ? data.parent : originalDoc?.parent
        let parentId = relationId(parentValue as RelationValue)
        if (!parentId) return data

        if (currentId && String(parentId) === String(currentId)) {
          throw new Error('Uma categoria não pode ser categoria principal de si mesma.')
        }

        const visited = new Set<string>()
        while (parentId) {
          const key = String(parentId)
          if (visited.has(key)) {
            throw new Error('A hierarquia selecionada já contém um ciclo de categorias.')
          }
          visited.add(key)

          if (currentId && key === String(currentId)) {
            throw new Error('A categoria principal não pode ser uma descendente desta categoria.')
          }

          const parent = await req.payload.findByID({
            collection: 'categories',
            id: parentId,
            depth: 0,
            overrideAccess: false,
            req,
          })
          parentId = relationId(parent?.parent as RelationValue)
        }

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
              dbName: 'category_state',
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
              admin: {
                description: 'A hierarquia é validada contra autorreferência e ciclos antes de salvar.',
              },
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
