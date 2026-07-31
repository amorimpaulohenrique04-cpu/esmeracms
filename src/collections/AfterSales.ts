import type { CollectionConfig } from 'payload'

import { commercialUsers } from '../access/roles'
import { businessUserRelationship } from '../fields/userRelationship'
import { applyAfterSalesRules } from '../hooks/afterSales/applyAfterSalesRules'

export const AfterSales: CollectionConfig = {
  slug: 'after-sales',
  trash: true,
  labels: { singular: 'Pós-venda', plural: 'Pós-venda' },
  admin: {
    group: 'Business',
    useAsTitle: 'id',
    defaultColumns: ['customer', 'sale', 'status', 'priority', 'expectedDeliveryAt', 'updatedAt'],
  },
  access: {
    admin: commercialUsers,
    read: commercialUsers,
    create: commercialUsers,
    update: commercialUsers,
    delete: commercialUsers,
    readVersions: commercialUsers,
  },
  versions: { maxPerDoc: 100 },
  hooks: { beforeValidate: [applyAfterSalesRules] },
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
            businessUserRelationship('owner', 'Responsável'),
          ],
        },
        {
          label: 'Entrega',
          fields: [
            { name: 'expectedDeliveryAt', type: 'date', label: 'Entrega prevista', admin: { date: { pickerAppearance: 'dayAndTime' } } },
            { name: 'deliveredAt', type: 'date', label: 'Entrega realizada', admin: { date: { pickerAppearance: 'dayAndTime' } } },
            { name: 'deliveryNotes', type: 'textarea', label: 'Observações da entrega' },
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
              validate: (value: unknown, { siblingData }: { siblingData?: { incidentType?: string } }) =>
                siblingData?.incidentType === 'none' || Boolean(String(value || '').trim()) || 'Descreva a ocorrência.',
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
