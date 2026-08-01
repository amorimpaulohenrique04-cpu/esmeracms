import type { CollectionConfig } from 'payload'

import { commercialUsers } from '../access/roles'
import { businessUserRelationship } from '../fields/userRelationship'
import { applyLeadRules } from '../hooks/leads/applyLeadRules'

const phoneValidation = (value: unknown, { siblingData }: { siblingData?: { email?: string } }) => {
  if (!value && !siblingData?.email) return 'Informe telefone ou e-mail.'
  if (value && !/^\+[1-9]\d{7,14}$/.test(String(value))) return 'Use o formato E.164, como +5511999990000.'
  return true
}

export const Leads: CollectionConfig = {
  slug: 'leads',
  trash: true,
  labels: { singular: 'Lead', plural: 'Leads' },
  admin: {
    group: 'Business',
    useAsTitle: 'name',
    defaultColumns: ['name', 'stage', 'opportunity', 'source', 'owner', 'nextActionAt', 'updatedAt'],
    listSearchableFields: ['name', 'phone', 'email', 'notes'],
    description: 'Leads representam entrada e qualificação. Etapas comerciais legadas permanecem somente durante o ciclo de compatibilidade com Opportunities.',
  },
  access: {
    admin: commercialUsers,
    read: commercialUsers,
    create: commercialUsers,
    update: commercialUsers,
    delete: commercialUsers,
    readVersions: commercialUsers,
  },
  versions: { maxPerDoc: 50 },
  hooks: {
    beforeChange: [applyLeadRules],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Contato',
          fields: [
            { name: 'name', type: 'text', label: 'Nome', required: true },
            { name: 'phone', type: 'text', label: 'Telefone', validate: phoneValidation },
            { name: 'email', type: 'email', label: 'E-mail' },
          ],
        },
        {
          label: 'Qualificação e compatibilidade',
          description: 'A negociação passa a ser representada por Opportunity. Estes campos permanecem para leitura e migração durante um ciclo de release.',
          fields: [
            {
              name: 'source',
              type: 'select',
              label: 'Origem',
              required: true,
              options: [
                { label: 'Instagram', value: 'instagram' },
                { label: 'Indicação', value: 'referral' },
                { label: 'Site', value: 'site' },
                { label: 'Arquiteto', value: 'architect' },
                { label: 'Orgânico', value: 'organic' },
                { label: 'WhatsApp', value: 'whatsapp' },
                { label: 'Outro', value: 'other' },
              ],
            },
            {
              name: 'stage',
              type: 'select',
              label: 'Etapa legada',
              required: true,
              defaultValue: 'new',
              index: true,
              admin: { description: 'Não usar como novo pipeline após a migração. A fonte comercial passa a ser Opportunities.' },
              options: [
                { label: 'Novo', value: 'new' },
                { label: 'Curadoria', value: 'curation' },
                { label: 'Proposta', value: 'proposal' },
                { label: 'Negociação', value: 'negotiation' },
                { label: 'Ganho', value: 'won' },
                { label: 'Perdido', value: 'lost' },
              ],
            },
            businessUserRelationship('owner', 'Responsável'),
            { name: 'nextAction', type: 'text', label: 'Próxima ação legada' },
            { name: 'nextActionAt', type: 'date', label: 'Prazo legado', admin: { date: { pickerAppearance: 'dayAndTime' } } },
            {
              name: 'closedAt',
              type: 'date',
              label: 'Encerrado em',
              index: true,
              admin: { readOnly: true, position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } },
            },
            {
              name: 'lossReason',
              type: 'textarea',
              label: 'Motivo da perda legado',
              admin: { condition: (_, siblingData) => siblingData?.stage === 'lost' },
            },
            {
              name: 'customer',
              type: 'relationship',
              relationTo: 'customers',
              label: 'Cliente qualificado',
            },
            {
              name: 'opportunity',
              type: 'relationship',
              relationTo: 'opportunities',
              label: 'Oportunidade migrada',
              index: true,
              admin: { readOnly: true, position: 'sidebar' },
            },
            {
              name: 'opportunityMigratedAt',
              type: 'date',
              label: 'Migração comercial',
              admin: { readOnly: true, position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } },
            },
          ],
        },
        {
          label: 'Interesse',
          fields: [
            {
              name: 'interestCategories',
              type: 'relationship',
              relationTo: 'categories',
              hasMany: true,
              label: 'Categorias de interesse',
            },
            {
              name: 'interestedProducts',
              type: 'relationship',
              relationTo: 'products',
              hasMany: true,
              label: 'Produtos de interesse',
            },
            { name: 'notes', type: 'textarea', label: 'Notas' },
          ],
        },
        {
          label: 'Privacidade',
          fields: [
            { name: 'marketingConsent', type: 'checkbox', label: 'Consentimento para comunicações', defaultValue: false },
            {
              name: 'consentRecordedAt',
              type: 'date',
              label: 'Consentimento registrado em',
              admin: {
                condition: (_, siblingData) => siblingData?.marketingConsent === true,
                date: { pickerAppearance: 'dayAndTime' },
              },
            },
          ],
        },
      ],
    },
  ],
}
