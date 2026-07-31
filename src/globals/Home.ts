import type { GlobalConfig } from 'payload'

import { canManageSite, publishedGlobalOrAuthenticated, siteEditors } from '../access/roles'
import { callToActionFields, imageWithAltFields, seoField } from '../fields/common'

export const Home: GlobalConfig = {
  slug: 'home',
  label: 'Home',
  admin: { group: 'Site', hidden: ({ user }) => !canManageSite(user) },
  access: {
    read: publishedGlobalOrAuthenticated,
    update: siteEditors,
    readVersions: siteEditors,
  },
  versions: { drafts: true, max: 50 },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Galeria Hero',
          fields: [
            {
              name: 'heroMode',
              type: 'select',
              label: 'Modo da Hero',
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
              label: 'Galeria da Hero',
              minRows: 1,
              maxRows: 5,
              required: true,
              fields: [
                imageWithAltFields('desktopImage', 'Imagem desktop', true),
                imageWithAltFields('mobileImage', 'Imagem mobile', true),
                { name: 'statement', type: 'text', label: 'Frase principal', required: true, maxLength: 120 },
                callToActionFields(),
                { name: 'active', type: 'checkbox', label: 'Ativo', defaultValue: true },
              ],
              validate: (value: unknown, { siblingData }: { siblingData?: { heroMode?: string } }) => {
                const slides = Array.isArray(value) ? value : []
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
            { name: 'manifestoTitle', type: 'text', label: 'Título', required: true },
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
              required: true,
              validate: (value: unknown) =>
                (Array.isArray(value) && value.length === 4) || 'Escolha exatamente 4 produtos.',
              admin: { description: 'Nenhum dado do produto é copiado aqui.' },
            },
          ],
        },
        {
          label: 'Matter',
          fields: [
            {
              name: 'matterPanels',
              type: 'array',
              label: 'Painéis Matter',
              minRows: 3,
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
          label: 'Signature',
          fields: [
            {
              name: 'signatureSlides',
              type: 'array',
              label: 'Slides Signature',
              minRows: 1,
              maxRows: 6,
              fields: [
                { name: 'product', type: 'relationship', relationTo: 'products', label: 'Produto', required: true },
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
  ],
}
