import type { CollectionConfig } from 'payload'

import { commercialUsers } from '../access/roles'

export const Customers: CollectionConfig = {
  slug: 'customers',
  trash: true,
  labels: { singular: 'Cliente', plural: 'Clientes' },
  admin: {
    group: 'Business',
    useAsTitle: 'name',
    defaultColumns: ['name', 'phone', 'email', 'city', 'state', 'updatedAt'],
    listSearchableFields: ['name', 'phone', 'email', 'city', 'tags'],
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
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Contato',
          fields: [
            { name: 'name', type: 'text', label: 'Nome', required: true },
            {
              name: 'phone',
              type: 'text',
              label: 'Telefone',
              validate: (value: unknown, { siblingData }: { siblingData?: { email?: string } }) => {
                if (!value && !siblingData?.email) return 'Informe telefone ou e-mail.'
                if (value && !/^\+[1-9]\d{7,14}$/.test(String(value))) return 'Use o formato E.164.'
                return true
              },
            },
            { name: 'email', type: 'email', label: 'E-mail' },
            { name: 'city', type: 'text', label: 'Cidade' },
            { name: 'state', type: 'text', label: 'Estado' },
          ],
        },
        {
          label: 'Relacionamento',
          fields: [
            { name: 'sourceLead', type: 'relationship', relationTo: 'leads', label: 'Lead de origem' },
            {
              name: 'preferences',
              type: 'array',
              label: 'Preferências',
              fields: [{ name: 'value', type: 'text', label: 'Preferência', required: true }],
            },
            {
              name: 'tags',
              type: 'array',
              label: 'Tags',
              fields: [{ name: 'value', type: 'text', label: 'Tag', required: true }],
            },
            { name: 'relationshipNotes', type: 'textarea', label: 'Notas do relacionamento' },
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
            { name: 'dataHandlingNotes', type: 'textarea', label: 'Observações de privacidade' },
          ],
        },
      ],
    },
  ],
}
