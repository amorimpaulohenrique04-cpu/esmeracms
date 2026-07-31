import { ValidationError, type CollectionConfig, type Where } from 'payload'

import { activeCategoriesOrAuthenticated, siteEditors } from '../access/roles'
import { getCategoryHierarchyIssues } from '../businessRules/categories/hierarchy'
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
    listSearchableFields: ['title', 'slug'],
  },
  access: {
    admin: siteEditors,
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
      async ({ data, originalDoc, req }) => {
        if (!data) return data
        if (data.title && !data.slug) data.slug = slugify(String(data.title))

        const id = originalDoc?.id as string | number | undefined
        const parent = data.parent !== undefined ? data.parent : originalDoc?.parent
        const hierarchyIssues = await getCategoryHierarchyIssues(req, id, parent)
        if (hierarchyIssues.length) {
          throw new ValidationError({
            collection: 'categories',
            id,
            req,
            errors: hierarchyIssues.map((message) => ({ path: 'parent', message })),
          })
        }

        const nextStatus = data.status ?? originalDoc?.status
        if (id !== undefined && nextStatus === 'archive') {
          const where: Where = {
            and: [
              { categories: { contains: id } },
              { catalogStatus: { equals: 'active' } },
              { _status: { equals: 'published' } },
            ],
          }
          const linked = await req.payload.count({
            collection: 'products',
            where,
            overrideAccess: true,
            req,
          })
          if (linked.totalDocs > 0) {
            throw new ValidationError({
              collection: 'categories',
              id,
              req,
              errors: [{
                path: 'status',
                message: `Arquive ou mova ${linked.totalDocs} produto(s) ativo(s) e publicado(s) antes de arquivar esta categoria.`,
              }],
            })
          }
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
              admin: {
                description: 'Status controla participação no catálogo. Publicação é controlada separadamente pelo workflow do Payload.',
              },
            },
            {
              name: 'parent',
              type: 'relationship',
              relationTo: 'categories',
              label: 'Categoria principal',
              admin: {
                description: 'A hierarquia é validada no servidor; relações cíclicas são rejeitadas.',
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
              validate: (value: unknown) =>
                value === null || value === undefined || (typeof value === 'number' && Number.isInteger(value) && value >= 0) || 'Use um número inteiro maior ou igual a zero.',
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
