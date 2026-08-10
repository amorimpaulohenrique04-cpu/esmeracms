import type { CollectionConfig } from 'payload'

import { admins, commercialUsers } from '../access/roles'
import { acquisitionChannelOptions } from '../businessRules/shared/acquisitionChannels'
import {
  opportunityLossReasonLabels,
  opportunityLossReasons,
  opportunityStageLabels,
  opportunityStages,
} from '../businessRules/opportunities/stages'
import { businessUserRelationship } from '../fields/userRelationship'
import { applyOpportunityRules } from '../hooks/opportunities/applyOpportunityRules'
import { automateWonOpportunity } from '../hooks/opportunities/automateWonOpportunity'
import { logOpportunityActivity } from '../hooks/opportunities/logOpportunityActivity'

export const Opportunities: CollectionConfig = {
  slug: 'opportunities',
  labels: { singular: 'Oportunidade', plural: 'Oportunidades' },
  admin: {
    group: 'Business',
    useAsTitle: 'code',
    defaultColumns: ['customer', 'code', 'stage', 'estimatedValueCents', 'owner', 'nextActionAt', 'updatedAt'],
    listSearchableFields: ['code', 'nextAction', 'lossNotes'],
  },
  access: {
    admin: commercialUsers,
    read: commercialUsers,
    create: commercialUsers,
    update: commercialUsers,
    delete: admins,
    readVersions: commercialUsers,
  },
  versions: { maxPerDoc: 100 },
  hooks: {
    beforeValidate: [applyOpportunityRules],
    afterChange: [automateWonOpportunity, logOpportunityActivity],
  },
  fields: [
    {
      type: 'collapsible',
      label: 'Cliente e Negócio',
      fields: [
        { name: 'customer', type: 'relationship', relationTo: 'customers', label: 'Cliente', index: true, admin: { description: 'Busque um cliente existente ou use o cadastro rápido no workspace de Oportunidades.' } },
        { name: 'source', type: 'select', label: 'Origem do Lead', required: true, defaultValue: 'other', index: true, options: acquisitionChannelOptions },
        { ...businessUserRelationship('owner', 'Responsável'), index: true },
      ],
    },
    {
      type: 'collapsible',
      label: 'Financeiro e Comercial',
      fields: [
        { name: 'interestedProducts', type: 'relationship', relationTo: 'products', hasMany: true, label: 'Produto / Serviço' },
        {
          name: 'estimatedValueCents',
          type: 'number',
          label: 'Valor Estimado',
          min: 0,
          admin: {
            description: 'Informe o valor em reais. O CMS mantém o armazenamento interno em centavos.',
            components: { Field: '/admin/components/CurrencyCentsField#CurrencyCentsField' },
          },
        },
        { name: 'stage', type: 'select', label: 'Etapa do Funil', required: true, defaultValue: 'new', index: true, options: opportunityStages.map((value) => ({ label: opportunityStageLabels[value], value })) },
      ],
    },
    {
      type: 'collapsible',
      label: 'Follow-up',
      fields: [
        { name: 'nextAction', type: 'text', label: 'Descrição da Próxima Ação' },
        { name: 'nextActionAt', type: 'date', label: 'Data/Hora do Prazo', index: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
        {
          name: 'priority',
          type: 'select',
          label: 'Prioridade',
          defaultValue: 'normal',
          index: true,
          options: [
            { label: 'Baixa', value: 'low' },
            { label: 'Normal', value: 'normal' },
            { label: 'Alta', value: 'high' },
            { label: 'Urgente', value: 'urgent' },
          ],
        },
      ],
    },
    { name: 'code', type: 'text', label: 'Código', required: true, unique: true, index: true, admin: { hidden: true, readOnly: true } },
    { name: 'rank', type: 'number', label: 'Ordem no estágio', required: true, index: true, admin: { hidden: true } },
    { name: 'expectedCloseAt', type: 'date', label: 'Fechamento esperado', index: true, admin: { hidden: true } },
    { name: 'closedAt', type: 'date', label: 'Encerrada em', index: true, admin: { hidden: true, readOnly: true } },
    { name: 'lossReason', type: 'select', label: 'Motivo da perda', options: opportunityLossReasons.map((value) => ({ label: opportunityLossReasonLabels[value], value })), admin: { hidden: true } },
    { name: 'lossNotes', type: 'textarea', label: 'Contexto da perda', admin: { hidden: true } },
    { name: 'wonSale', type: 'relationship', relationTo: 'sales', label: 'Venda gerada', unique: true, index: true, admin: { hidden: true, readOnly: true } },
    { name: 'sourceLead', type: 'relationship', relationTo: 'leads', label: 'Lead de origem', unique: true, index: true, admin: { hidden: true, readOnly: true } },
    { name: 'migrationVersion', type: 'text', label: 'Versão da migração', index: true, admin: { hidden: true, readOnly: true } },
    { name: 'migratedAt', type: 'date', label: 'Migrada em', admin: { hidden: true, readOnly: true } },
  ],
}
