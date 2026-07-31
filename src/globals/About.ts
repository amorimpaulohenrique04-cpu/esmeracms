import type { GlobalConfig } from 'payload'

import { canManageSite, publishedGlobalOrAuthenticated, siteEditors } from '../access/roles'
import { callToActionFields, imageWithAltFields, seoField } from '../fields/common'

export const About: GlobalConfig = {
  slug: 'about',
  label: 'Sobre',
  admin: { group: 'Site', hidden: ({ user }) => !canManageSite(user) },
  access: { read: publishedGlobalOrAuthenticated, update: siteEditors, readVersions: siteEditors },
  versions: { drafts: true, max: 30 },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Introdução',
          fields: [
            { name: 'title', type: 'text', label: 'Título', required: true },
            { name: 'intro', type: 'richText', label: 'Introdução' },
            imageWithAltFields('heroImage', 'Imagem principal'),
          ],
        },
        {
          label: 'Maison',
          fields: [
            { name: 'maisonTitle', type: 'text', label: 'Título' },
            { name: 'maisonCopy', type: 'richText', label: 'Texto' },
            imageWithAltFields('maisonImage', 'Imagem'),
          ],
        },
        {
          label: 'Visão e matéria',
          fields: [
            { name: 'visionTitle', type: 'text', label: 'Título' },
            { name: 'visionCopy', type: 'richText', label: 'Texto' },
            imageWithAltFields('visionImage', 'Imagem'),
          ],
        },
        {
          label: 'Proveniência',
          fields: [
            { name: 'provenanceTitle', type: 'text', label: 'Título' },
            { name: 'provenanceCopy', type: 'richText', label: 'Texto' },
            imageWithAltFields('provenanceImage', 'Imagem'),
            callToActionFields(),
          ],
        },
        { label: 'SEO', fields: [seoField()] },
      ],
    },
  ],
}
