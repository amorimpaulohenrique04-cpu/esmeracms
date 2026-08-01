import type { CollectionConfig } from 'payload'

import { commercialUsers } from '../access/roles'
import {
  afterSalesStatuses,
  afterSalesStatusLabels,
  operationalPriorities,
  operationalPriorityLabels,
} from '../businessRules/afterSales/model'
import { businessUserRelationship } from '../fields/userRelationship'
import { applyAfterSalesRules } from '../hooks/afterSales/applyAfterSalesRules'

export const AfterSales: CollectionConfig = {
  slug: 'after-sales',
  trash: true,
  labels: { singular: 'Caso de pós-venda', plural: 'Pós-venda' },
  admin: {
    group: 'Business',
    useAsTitle: 'caseNumber',
    defaultColumns: ['caseNumber', 'customer', 'sale', 'status', 'priority', 'owner', 'updatedAt'],
    listSearchableFields: ['caseNumber', 'summary'],
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
          label: 'Caso',
          fields: [
            { name: 'caseNumber', type: 'text', label: 'Código', unique: true, index: true, admin: { readOnly: true } },
            { name: 'sale', type: 'relationship', relationTo: 'sales', label: 'Venda', required: true, index: true },
            { name: 'customer', type: 'relationship', relationTo: 'customers', label: 'Cliente', required: true, index: true, admin: { readOnly: true } },
            { name: 'summary', type: 'textarea', label: 'Contexto do acompanhamento' },
            {
              name: 'status',
              type: 'select',
              label: 'Status',
              required: true,
              defaultValue: 'open',
              index: true,
              options: afterSalesStatuses.map((value) => ({ label: afterSalesStatusLabels[value], value })),
            },
            {
              name: 'priority',
              type: 'select',
              label: 'Prioridade',
              required: true,
              defaultValue: 'normal',
              index: true,
              options: operationalPriorities.map((value) => ({ label: operationalPriorityLabels[value], value })),
            },
            businessUserRelationship('owner', 'Responsável'),
            { name: 'openedAt', type: 'date', label: 'Aberto em', required: true, index: true, admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
            { name: 'closedAt', type: 'date', label: 'Encerrado em', index: true, admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
          ],
        },
        {
          label: 'Legado',
          description: 'Campos preservados temporariamente para a migração idempotente. A fila operacional usa Tasks, Shipments e Occurrences.',
          fields: [
            { name: 'expectedDeliveryAt', type: 'date', label: 'Entrega prevista legada', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
            { name: 'deliveredAt', type: 'date', label: 'Entrega realizada legada', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
            { name: 'deliveryNotes', type: 'textarea', label: 'Observações de entrega legadas', admin: { readOnly: true } },
            {
              name: 'followUps',
              type: 'array',
              label: 'Follow-ups legados',
              admin: { readOnly: true, description: 'Novos follow-ups devem ser criados em Tasks. Este array permanece somente durante o ciclo de migração.' },
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
            {
              name: 'incidentType',
              type: 'select',
              label: 'Tipo de ocorrência legado',
              defaultValue: 'none',
              admin: { readOnly: true },
              options: [
                { label: 'Sem ocorrência', value: 'none' },
                { label: 'Avaria', value: 'damage' },
                { label: 'Ajuste', value: 'adjustment' },
                { label: 'Manutenção', value: 'maintenance' },
                { label: 'Outro', value: 'other' },
              ],
            },
            { name: 'incidentDetails', type: 'textarea', label: 'Descrição da ocorrência legada', admin: { readOnly: true } },
            { name: 'resolution', type: 'textarea', label: 'Resolução legada', admin: { readOnly: true } },
          ],
        },
      ],
    },
  ],
}
