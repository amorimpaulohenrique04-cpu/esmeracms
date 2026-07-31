import type { GlobalConfig } from 'payload'

import { siteEditors } from '../access/roles'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Configurações do site',
  admin: { group: 'Site' },
  access: { read: () => true, update: siteEditors, readVersions: siteEditors },
  versions: { max: 30 },
  fields: [
    { name: 'siteName', type: 'text', label: 'Nome do site', defaultValue: 'Esméra' },
    { name: 'defaultSeoTitle', type: 'text', label: 'Título SEO padrão', maxLength: 60 },
    { name: 'defaultSeoDescription', type: 'textarea', label: 'Descrição SEO padrão', maxLength: 160 },
    {
      name: 'officialChannels',
      type: 'array',
      label: 'Canais oficiais',
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
        { name: 'value', type: 'text', label: 'Valor', required: true },
        { name: 'url', type: 'text', label: 'Link' },
        { name: 'active', type: 'checkbox', label: 'Ativo', defaultValue: true },
      ],
    },
    { name: 'frontendURL', type: 'text', label: 'URL do site', admin: { description: 'Exemplo: https://esmera.com.br' } },
    { name: 'analyticsConfigured', type: 'checkbox', label: 'Analytics configurado', defaultValue: false, admin: { description: 'Apenas sinaliza integração real. O CMS não inventa métricas de tráfego.' } },
  ],
}
