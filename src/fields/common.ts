import type { Field } from 'payload'

export const seoField = (): Field => ({
  name: 'seo',
  type: 'group',
  label: 'SEO',
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Título para busca',
      maxLength: 60,
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Descrição para busca',
      maxLength: 160,
    },
    {
      name: 'socialImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Imagem social',
    },
    {
      name: 'noIndex',
      type: 'checkbox',
      label: 'Ocultar dos buscadores',
      defaultValue: false,
    },
  ],
})

export const callToActionFields = (name = 'callToAction', label = 'Chamada para ação'): Field => ({
  name,
  type: 'group',
  label,
  fields: [
    {
      name: 'label',
      type: 'text',
      label: 'Texto do botão',
      maxLength: 50,
    },
    {
      name: 'destinationType',
      type: 'select',
      label: 'Destino',
      defaultValue: 'internal',
      options: [
        { label: 'Página do site', value: 'internal' },
        { label: 'Link externo', value: 'external' },
        { label: 'WhatsApp oficial', value: 'whatsapp' },
      ],
    },
    {
      name: 'path',
      type: 'text',
      label: 'Caminho no site',
      admin: {
        condition: (_, siblingData) => siblingData?.destinationType === 'internal',
        description: 'Exemplo: /colecao',
      },
      validate: (value: unknown, { siblingData }: { siblingData?: { destinationType?: string } }) => {
        if (siblingData?.destinationType !== 'internal') return true
        if (!value) return 'Informe o caminho.'
        return /^\/(?:[a-z0-9-]+\/?)*$/.test(String(value)) || 'Use um caminho como /colecao.'
      },
    },
    {
      name: 'url',
      type: 'text',
      label: 'URL externa',
      admin: {
        condition: (_, siblingData) => siblingData?.destinationType === 'external',
      },
      validate: (value: unknown, { siblingData }: { siblingData?: { destinationType?: string } }) => {
        if (siblingData?.destinationType !== 'external') return true
        if (!value) return 'Informe a URL.'
        try {
          const parsed = new URL(String(value))
          return ['http:', 'https:'].includes(parsed.protocol) || 'Use uma URL http ou https.'
        } catch {
          return 'Informe uma URL válida.'
        }
      },
    },
  ],
})

export const imageWithAltFields = (name: string, label: string, required = false): Field => ({
  name,
  type: 'group',
  label,
  fields: [
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: 'Imagem',
      required,
    },
    {
      name: 'alt',
      type: 'text',
      label: 'Texto alternativo',
      maxLength: 180,
      required,
      admin: {
        description: 'Descreva a imagem para pessoas que usam leitores de tela.',
      },
    },
    {
      name: 'caption',
      type: 'text',
      label: 'Legenda',
    },
  ],
})

export function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
