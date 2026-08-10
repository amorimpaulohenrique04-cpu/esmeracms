import type { GlobalConfig, Where } from 'payload'

import { canManageSite, publishedGlobalOrAuthenticated, siteEditors } from '../access/roles'
import { callToActionFields, imageWithAltFields, seoField } from '../fields/common'
import { publicationMetadataFields } from '../server/publication/publicationMetadataFields'
import { stampPublishedHomeMetadata } from '../server/publication/stampPublicationMetadata'

export const HOME_DISABLED_SECTIONS = [
  'hero',
  'manifesto',
  'selectedObjects',
  'matter',
  'signature',
  'matterInterlude',
  'provenance',
  'privateInvitation',
] as const

const PUBLIC_HOME_PRODUCT_FILTER: Where = {
  and: [
    { catalogStatus: { equals: 'active' } },
    { _status: { equals: 'published' } },
    { publicationReady: { equals: true } },
  ],
}

export const Home: GlobalConfig = {
  slug: 'home',
  label: 'Home',
  admin: {
    group: 'Site',
    hidden: ({ user }) => !canManageSite(user),
    components: {
      views: {
        edit: {
          default: {
            Component: '/admin/modules/home/HomeEditView#HomeEditView',
          },
        },
      },
    },
  },
  access: {
    read: publishedGlobalOrAuthenticated,
    update: siteEditors,
    readVersions: siteEditors,
  },
  versions: { drafts: true, max: 50 },
  hooks: {
    afterChange: [stampPublishedHomeMetadata],
  },
  fields: [
    {
      name: 'disabledSections',
      type: 'select',
      hasMany: true,
      label: 'Seções desativadas',
      options: [
        { label: 'Capa principal', value: 'hero' },
        { label: 'Manifesto', value: 'manifesto' },
        { label: 'Seleção de objetos', value: 'selectedObjects' },
        { label: 'Matéria', value: 'matter' },
        { label: 'Destaques', value: 'signature' },
        { label: 'Intervalo visual', value: 'matterInterlude' },
        { label: 'Proveniência', value: 'provenance' },
        { label: 'Convite privado', value: 'privateInvitation' },
      ],
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Capa principal',
          fields: [
            {
              name: 'heroMode',
              type: 'select',
              label: 'Modo da capa',
              required: true,
              defaultValue: 'single',
              options: [
                { label: 'Uma imagem', value: 'single' },
                { label: 'Carrossel', value: 'carousel' },
              ],
            },
            {
              name: 'heroSlides',
              type: 'array',
              label: 'Galeria da capa',
              minRows: 0,
              maxRows: 5,
              required: false,
              fields: [
                imageWithAltFields('desktopImage', 'Imagem desktop', true),
                imageWithAltFields('mobileImage', 'Imagem mobile', true),
                { name: 'statement', type: 'text', label: 'Frase principal', required: true, maxLength: 120 },
                callToActionFields(),
                { name: 'active', type: 'checkbox', label: 'Ativo', defaultValue: true },
              ],
              validate: (value: unknown, { siblingData }: { siblingData?: { heroMode?: string } }) => {
                const slides = Array.isArray(value) ? value : []
                if (slides.length === 0) return true

                const activeCount = slides.filter((slide) => (slide as { active?: boolean }).active !== false).length
                if (siblingData?.heroMode === 'single' && activeCount !== 1) return 'No modo de uma imagem, deixe exatamente um slide ativo.'
                if (siblingData?.heroMode === 'carousel' && (activeCount < 2 || activeCount > 5)) return 'No carrossel, deixe entre 2 e 5 slides ativos.'
                return true
              },
            },
            {
              name: 'autoplay',
              type: 'checkbox',
              label: 'Avançar automaticamente',
              defaultValue: false,
              admin: { condition: (_, siblingData) => siblingData?.heroMode === 'carousel' },
            },
            {
              name: 'autoplaySeconds',
              type: 'number',
              label: 'Intervalo em segundos',
              min: 3,
              max: 12,
              admin: { condition: (_, siblingData) => siblingData?.heroMode === 'carousel' && siblingData?.autoplay === true },
            },
          ],
        },
        {
          label: 'Manifesto',
          fields: [
            { name: 'manifestoEyebrow', type: 'text', label: 'Sobretítulo' },
            { name: 'manifestoTitle', type: 'text', label: 'Título' },
            { name: 'manifestoCopy', type: 'richText', label: 'Texto' },
            imageWithAltFields('manifestoPrimaryImage', 'Imagem principal'),
            imageWithAltFields('manifestoSecondaryImage', 'Imagem secundária'),
          ],
        },
        {
          label: 'Seleção',
          fields: [
            {
              name: 'selectedProducts',
              type: 'relationship',
              relationTo: 'products',
              hasMany: true,
              label: 'Seleção de produtos',
              required: false,
              minRows: 0,
              maxRows: 4,
              filterOptions: PUBLIC_HOME_PRODUCT_FILTER,
              admin: {
                description: 'Selecione até 4 produtos ativos, publicados e prontos para o storefront. Nenhum dado do produto é copiado aqui.',
              },
            },
          ],
        },
        {
          label: 'Matéria',
          fields: [
            {
              name: 'matterPanels',
              type: 'array',
              label: 'Painéis da matéria',
              minRows: 0,
              maxRows: 3,
              fields: [
                { name: 'category', type: 'relationship', relationTo: 'categories', label: 'Categoria', required: true },
                imageWithAltFields('image', 'Imagem', true),
                { name: 'eyebrow', type: 'text', label: 'Sobretítulo' },
                { name: 'headline', type: 'text', label: 'Título', required: true },
                { name: 'copy', type: 'textarea', label: 'Texto' },
                callToActionFields(),
              ],
            },
          ],
        },
        {
          label: 'Destaques',
          fields: [
            {
              name: 'signatureSlides',
              type: 'array',
              label: 'Slides de destaque',
              minRows: 0,
              maxRows: 6,
              fields: [
                {
                  name: 'product',
                  type: 'relationship',
                  relationTo: 'products',
                  label: 'Produto',
                  required: true,
                  filterOptions: PUBLIC_HOME_PRODUCT_FILTER,
                },
                { name: 'eyebrow', type: 'text', label: 'Sobretítulo' },
                { name: 'headline', type: 'text', label: 'Título editorial' },
                { name: 'copy', type: 'textarea', label: 'Texto editorial' },
              ],
            },
          ],
        },
        {
          label: 'Proveniência',
          fields: [
            { name: 'provenanceTitle', type: 'text', label: 'Título' },
            { name: 'provenanceCopy', type: 'richText', label: 'Texto' },
            imageWithAltFields('provenanceImage', 'Imagem'),
            {
              name: 'provenanceSteps',
              type: 'array',
              label: 'Etapas',
              maxRows: 6,
              fields: [
                { name: 'title', type: 'text', label: 'Título', required: true },
                { name: 'copy', type: 'textarea', label: 'Texto' },
                imageWithAltFields('image', 'Imagem'),
                callToActionFields('link', 'Link (opcional)'),
              ],
            },
            callToActionFields('provenanceCallToAction', 'Chamada para ação'),
          ],
        },
        {
          label: 'SEO',
          fields: [seoField()],
        },
      ],
    },
    ...publicationMetadataFields(),
  ],
}
