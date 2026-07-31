import type { GlobalConfig } from 'payload'

import { publishedGlobalOrAuthenticated, siteEditors } from '../access/roles'
import { callToActionFields, imageWithAltFields, seoField } from '../fields/common'

export const Contact: GlobalConfig = {
  slug: 'contact',
  label: 'Contato',
  admin: { group: 'Site' },
  access: { read: publishedGlobalOrAuthenticated, update: siteEditors, readVersions: siteEditors },
  versions: { drafts: true, max: 30 },
  fields: [
    { name: 'title', type: 'text', label: 'Título', required: true },
    { name: 'intro', type: 'richText', label: 'Texto de abertura' },
    { name: 'useOfficialChannels', type: 'checkbox', label: 'Usar canais oficiais das Configurações', defaultValue: true },
    {
      name: 'channels',
      type: 'array',
      label: 'Canais específicos desta página',
      admin: { condition: (_, siblingData) => siblingData?.useOfficialChannels === false },
      fields: [
        { name: 'label', type: 'text', label: 'Nome', required: true },
        {
          name: 'kind',
          type: 'select',
          label: 'Tipo',
          required: true,
          options: [
            { label: 'Instagram', value: 'instagram' },
            { label: 'E-mail', value: 'email' },
            { label: 'Telefone', value: 'phone' },
            { label: 'WhatsApp', value: 'whatsapp' },
            { label: 'Site externo', value: 'website' },
            { label: 'Outro', value: 'other' },
          ],
        },
        { name: 'value', type: 'text', label: 'Endereço, usuário ou número', required: true },
        { name: 'url', type: 'text', label: 'Link' },
        { name: 'active', type: 'checkbox', label: 'Ativo', defaultValue: true },
      ],
    },
    { name: 'serviceHours', type: 'textarea', label: 'Horário de atendimento' },
    callToActionFields(),
    imageWithAltFields('image', 'Imagem'),
    seoField(),
  ],
}
