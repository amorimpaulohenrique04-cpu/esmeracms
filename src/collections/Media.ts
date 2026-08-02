import type { CollectionConfig } from 'payload'

import { publishedMediaOrAuthenticated, siteEditors } from '../access/roles'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: 'Mídia',
    plural: 'Mídia',
  },
  admin: {
    group: 'Site',
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'alt', 'updatedAt'],
  },
  access: {
    admin: siteEditors,
    read: publishedMediaOrAuthenticated,
    create: siteEditors,
    update: siteEditors,
    delete: siteEditors,
  },
  versions: {
    drafts: true,
    maxPerDoc: 30,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: 'Texto alternativo',
      required: true,
      maxLength: 180,
      admin: {
        description: 'Obrigatório para imagens informativas e acessibilidade.',
      },
    },
    {
      name: 'caption',
      type: 'text',
      label: 'Legenda',
    },
    {
      name: 'credit',
      type: 'text',
      label: 'Crédito',
    },
  ],
  upload: {
    focalPoint: true,
    imageSizes: [
      { name: 'thumb', width: 320, height: 320, position: 'centre' },
      { name: 'card', width: 900, height: 1125, position: 'centre' },
      { name: 'wide', width: 1800, height: 1200, position: 'centre' },
    ],
  },
}
