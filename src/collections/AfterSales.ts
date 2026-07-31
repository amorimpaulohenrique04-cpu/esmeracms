import type { CollectionConfig } from 'payload'

import { commercialUsers } from '../access/roles'

type FollowUp = {
  status?: string | null
  completedAt?: string | null
  [key: string]: unknown
}

export const AfterSales: CollectionConfig = {
  slug: 'after-sales',
  trash: true,
  labels: { singular: 'Pós-venda', plural: 'Pós-venda' },
  admin: {
    group: 'Business',
    useAsTitle: 'id',
    defaultColumns: ['customer', 'sale', 'status', 'priority', 'ownerUser', 'updatedAt'],
  },
  access: {
    read: commercialUsers,
    create: commercialUsers,
    update: commercialUsers,
    delete: commercialUsers,
    readVersions: commercialUsers,
  },
  versions: { maxPerDoc: 100 },
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (!data || !Array.isArray(data.followUps)) return data
        data.followUps = (data.followUps as FollowUp[]).map((followUp) => {
          if (followUp.status === 'done' && !followUp.completedAt) {
            return { ...followUp, completedAt: new Date().toISOString() }
          }
          if (followUp.status !== 'done' && followUp.completedAt) {
            return { ...followUp, completedAt: null }
          }
          return followUp
        })
        return data
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Acompanhamento',
          fields: [
            { name: 'sale', type: 'relationship', relationTo: 'sales', label: 'Venda', required: true },
            { name: 'customer', type: 'relationship', relationTo: 'customers', label: 'Cliente', required: true },
            {
              name: 'status',
              type: 'select',
              label: 'Status',
              required: true,
              defaultValue: 'open',
              options: [
                { label: 'Aberto', value: 'open' },
                { label: 'Acompanhando', value: 'following' },
                { label: 'Resolvido', value: 'resolved' },
                { label: 'Encerrado', value: 'closed' },
              ],
            },
            {
              name: 'priority',
              type: 'select',
              label: 'Prioridade',
              required: true,
              defaultValue: 'normal',
              options: [
                { label: 'Baixa', value: 'low' },
                { label: 'Normal', value: 'normal' },
                { label: 'Alta', value: 'high' },
                { label: 'Urgente', value: 'urgent' },
              ],
            },
            {
              name: 'ownerUser',
              type: 'relationship',
              relationTo: 'users',
              label: 'Responsável',
              index: true,
              filterOptions: {
                or: [{ role: { equals: 'admin' } }, { role: { equals: 'commercial' } }],
              },
            },
            {
              name: 'owner',
              type: 'text',
              label: 'Responsável legado',
              admin: { hidden: true, description: 'Compatibilidade temporária até a migração dos valores antigos para Users.' },
            },
          ],
        },
        {
          label: 'Entrega',
          fields: [
            {
              type: 'ui',
              name: 'deliverySourceInfo',
              admin: {
                components: {
                  Field: '/admin/components/DeliverySourceNote#DeliverySourceNote',
                },
              },
            },
            {
              name: 'expectedDeliveryAt',
              type: 'date',
              label: 'Entrega prevista (legado)',
              admin: { hidden: true, description: 'A venda relacionada é a fonte de verdade da entrega prevista.' },
            },
            {
              name: 'deliveredAt',
              type: 'date',
              label: 'Entrega realizada (legado)',
              admin: { hidden: true, description: 'A venda relacionada é a fonte de verdade da entrega realizada.' },
            },
            { name: 'deliveryNotes', type: 'textarea', label: 'Observações de monitoramento do pós-venda' },
          ],
        },
        {
          label: 'Follow-ups',
          fields: [
            {
              name: 'followUps',
              type: 'array',
              label: 'Follow-ups',
              fields: [
                {
                  name: 'moment',
                  type: 'select',
                  label: 'Momento',
                  required: true,
                  options: [
                    { label: 'D+3', value: 'd3' },
                    { label: 'D+15', value: 'd15' },
                    { label: 'D+90', value: 'd90' },
                    { label: 'Personalizado', value: 'custom' },
                  ],
                },
                { name: 'dueAt', type: 'date', label: 'Prazo', required: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
                {
                  name: 'purpose',
                  type: 'select',
                  label: 'Objetivo',
                  required: true,
                  options: [
                    { label: 'Confirmar recebimento', value: 'receipt' },
                    { label: 'Medir satisfação', value: 'satisfaction' },
                    { label: 'Pedir foto ou depoimento', value: 'testimonial' },
                    { label: 'Manutenção preventiva', value: 'maintenance' },
                    { label: 'Nova curadoria', value: 'curation' },
                    { label: 'Outro', value: 'other' },
                  ],
                },
                {
                  name: 'status',
                  type: 'select',
                  label: 'Status',
                  required: true,
                  defaultValue: 'pending',
                  options: [
                    { label: 'Pendente', value: 'pending' },
                    { label: 'Concluído', value: 'done' },
                    { label: 'Cancelado', value: 'cancelled' },
                  ],
                },
                { name: 'notes', type: 'textarea', label: 'Observações' },
                { name: 'completedAt', type: 'date', label: 'Concluído em', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
              ],
            },
          ],
        },
        {
          label: 'Ocorrência',
          fields: [
            {
              name: 'incidentType',
              type: 'select',
              label: 'Tipo de ocorrência',
              defaultValue: 'none',
              options: [
                { label: 'Sem ocorrência', value: 'none' },
                { label: 'Avaria', value: 'damage' },
                { label: 'Ajuste', value: 'adjustment' },
                { label: 'Manutenção', value: 'maintenance' },
                { label: 'Outro', value: 'other' },
              ],
            },
            {
              name: 'incidentDetails',
              type: 'textarea',
              label: 'Descrição da ocorrência',
              admin: { condition: (_, siblingData) => Boolean(siblingData?.incidentType && siblingData.incidentType !== 'none') },
            },
            {
              name: 'resolution',
              type: 'textarea',
              label: 'Resolução',
              admin: { condition: (_, siblingData) => Boolean(siblingData?.incidentType && siblingData.incidentType !== 'none') },
            },
          ],
        },
      ],
    },
  ],
}
