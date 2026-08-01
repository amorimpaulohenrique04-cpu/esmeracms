import type { GlobalConfig } from 'payload'

import { admins, commercialUsers } from '../access/roles'

export const AfterSalesAutomation: GlobalConfig = {
  slug: 'after-sales-automation',
  label: 'Automação de pós-venda',
  admin: {
    group: 'Business',
    description: 'Regras reais que alimentam a Payload Jobs Queue. Alterações afetam apenas novos agendamentos.',
  },
  access: {
    read: commercialUsers,
    update: admins,
    readVersions: admins,
  },
  versions: { max: 50 },
  fields: [
    {
      type: 'collapsible',
      label: 'Preparação da entrega',
      admin: { initCollapsed: false },
      fields: [
        {
          name: 'preparationEnabled',
          type: 'checkbox',
          label: 'Criar tarefa ao confirmar a venda',
          defaultValue: true,
        },
        {
          name: 'preparationDelayHours',
          type: 'number',
          label: 'Prazo inicial em horas',
          defaultValue: 0,
          min: 0,
          admin: {
            step: 1,
            description: 'Usado quando a venda não possui entrega prevista. Zero agenda a tarefa imediatamente.',
          },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Follow-ups após entrega',
      admin: { initCollapsed: false },
      fields: [
        {
          name: 'satisfactionEnabled',
          type: 'checkbox',
          label: 'Agendar satisfação',
          defaultValue: true,
        },
        {
          name: 'satisfactionDelayDays',
          type: 'number',
          label: 'Satisfação após quantos dias',
          defaultValue: 3,
          min: 0,
          admin: { step: 1, description: 'Regra padrão D+3.' },
        },
        {
          name: 'testimonialEnabled',
          type: 'checkbox',
          label: 'Agendar pedido de foto ou depoimento',
          defaultValue: true,
        },
        {
          name: 'testimonialDelayDays',
          type: 'number',
          label: 'Foto ou depoimento após quantos dias',
          defaultValue: 15,
          min: 0,
          admin: { step: 1, description: 'Regra padrão D+15.' },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Manutenção preventiva',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'maintenanceEnabled',
          type: 'checkbox',
          label: 'Agendar manutenção preventiva',
          defaultValue: false,
        },
        {
          name: 'maintenanceDelayDays',
          type: 'number',
          label: 'Manutenção após quantos dias',
          defaultValue: 90,
          min: 0,
          admin: { step: 1, description: 'Regra padrão D+90.' },
        },
        {
          name: 'maintenanceScope',
          type: 'select',
          label: 'Aplicação da regra',
          required: true,
          defaultValue: 'selected',
          options: [
            { label: 'Somente produtos ou categorias selecionados', value: 'selected' },
            { label: 'Todas as vendas entregues', value: 'all' },
          ],
        },
        {
          name: 'maintenanceProducts',
          type: 'relationship',
          relationTo: 'products',
          hasMany: true,
          label: 'Produtos com manutenção preventiva',
          admin: {
            condition: (_, siblingData) => siblingData?.maintenanceScope === 'selected',
          },
        },
        {
          name: 'maintenanceCategories',
          type: 'relationship',
          relationTo: 'categories',
          hasMany: true,
          label: 'Categorias com manutenção preventiva',
          admin: {
            condition: (_, siblingData) => siblingData?.maintenanceScope === 'selected',
          },
        },
      ],
    },
  ],
}
