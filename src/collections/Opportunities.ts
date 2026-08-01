import type { CollectionConfig } from 'payload'

import { admins, commercialUsers } from '../access/roles'
import {
  opportunityLossReasonLabels,
  opportunityLossReasons,
  opportunityStageLabels,
  opportunityStages,
} from '../businessRules/opportunities/stages'
import { businessUserRelationship } from '../fields/userRelationship'
import { applyOpportunityRules } from '../hooks/opportunities/applyOpportunityRules'
import { logOpportunityActivity } from '../hooks/opportunities/logOpportunityActivity'

export const Opportunities: CollectionConfig = {
  slug: 'opportunities',
  labels: { singular: 'Oportunidade', plural: 'Oportunidades' },
  admin: {
    group: 'Business',
    useAsTitle: 'code',
    defaultColumns: ['code', 'customer', 'stage', 'estimatedValueCents', 'owner', 'nextActionAt', 'updatedAt'],
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
    beforeChange: [applyOpportunityRules],
    afterChange: [logOpportunityActivity],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Oportunidade',
          fields: [
            {
              name: 'code',
              type: 'text',
              label: 'Código',
              required: true,
              unique: true,
              index: true,
              admin: { readOnly: true, description: 'Gerado automaticamente pelo domínio comercial.' },
            },
            {
              name: 'customer',
              type: 'relationship',
              relationTo: 'customers',
              label: 'Cliente',
              index: true,
              admin: { description: 'Pode permanecer vazio durante qualificação; torna-se obrigatório ao ganhar.' },
            },
            {
              name: 'source',
              type: 'select',
              label: 'Origem',
              index: true,
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
              label: 'Etapa comercial',
              required: true,
              defaultValue: 'new',
              index: true,
              options: opportunityStages.map((value) => ({ label: opportunityStageLabels[value], value })),
            },
            {
              name: 'rank',
              type: 'number',
              label: 'Ordem no estágio',
              required: true,
              index: true,
              admin: { position: 'sidebar', description: 'Usado para ordenar cards no Pipeline.' },
            },
            {
              ...businessUserRelationship('owner', 'Responsável'),
              index: true,
            },
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
        {
          label: 'Interesse e valor',
          fields: [
            {
              name: 'interestedProducts',
              type: 'relationship',
              relationTo: 'products',
              hasMany: true,
              label: 'Produtos de interesse',
            },
            {
              name: 'estimatedValueCents',
              type: 'number',
              label: 'Valor potencial em centavos',
              min: 0,
              admin: { description: 'Valor informado pelo operador. Nunca é estimado automaticamente.' },
            },
            { name: 'nextAction', type: 'text', label: 'Próxima ação' },
            {
              name: 'nextActionAt',
              type: 'date',
              label: 'Prazo da próxima ação',
              index: true,
              admin: { date: { pickerAppearance: 'dayAndTime' } },
            },
            {
              name: 'expectedCloseAt',
              type: 'date',
              label: 'Fechamento esperado',
              index: true,
              admin: { date: { pickerAppearance: 'dayAndTime' } },
            },
          ],
        },
        {
          label: 'Fechamento',
          fields: [
            {
              name: 'closedAt',
              type: 'date',
              label: 'Encerrada em',
              index: true,
              admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
            },
            {
              name: 'lossReason',
              type: 'select',
              label: 'Motivo da perda',
              options: opportunityLossReasons.map((value) => ({ label: opportunityLossReasonLabels[value], value })),
              admin: { condition: (_, siblingData) => siblingData?.stage === 'lost' },
            },
            {
              name: 'lossNotes',
              type: 'textarea',
              label: 'Contexto da perda',
              admin: { condition: (_, siblingData) => siblingData?.stage === 'lost' },
            },
            {
              name: 'wonSale',
              type: 'relationship',
              relationTo: 'sales',
              label: 'Venda gerada',
              unique: true,
              index: true,
              admin: { readOnly: true, condition: (_, siblingData) => siblingData?.stage === 'won' },
            },
          ],
        },
        {
          label: 'Compatibilidade',
          fields: [
            {
              name: 'sourceLead',
              type: 'relationship',
              relationTo: 'leads',
              label: 'Lead de origem',
              unique: true,
              index: true,
              admin: { readOnly: true, description: 'Vínculo mantido durante o ciclo de compatibilidade.' },
            },
            {
              name: 'migrationVersion',
              type: 'text',
              label: 'Versão da migração',
              index: true,
              admin: { readOnly: true },
            },
            {
              name: 'migratedAt',
              type: 'date',
              label: 'Migrada em',
              admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
            },
          ],
        },
      ],
    },
  ],
}
