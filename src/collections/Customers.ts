import type { CollectionConfig } from 'payload'

import { adminField, admins, commercialUsers } from '../access/roles'
import { businessUserRelationship } from '../fields/userRelationship'
import { applyCustomerPrivacyRules } from '../hooks/customers/applyCustomerPrivacyRules'
import { normalizeCustomer } from '../hooks/customers/normalizeCustomer'

export const customerOriginOptions = [
  { label: 'Instagram', value: 'instagram' },
  { label: 'Indicação', value: 'referral' },
  { label: 'Site', value: 'site' },
  { label: 'Arquiteto', value: 'architect' },
  { label: 'Orgânico', value: 'organic' },
  { label: 'WhatsApp', value: 'whatsapp' },
  { label: 'Outro', value: 'other' },
] as const

export const Customers: CollectionConfig = {
  slug: 'customers',
  trash: true,
  labels: { singular: 'Cliente', plural: 'Clientes' },
  admin: {
    group: 'Business',
    useAsTitle: 'name',
    defaultColumns: ['name', 'status', 'owner', 'phone', 'email', 'origin', 'updatedAt'],
    listSearchableFields: ['name', 'company', 'phone', 'email', 'city', 'tags.value'],
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
  hooks: { beforeValidate: [normalizeCustomer, applyCustomerPrivacyRules] },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Contato',
          fields: [
            { name: 'name', type: 'text', label: 'Nome', required: true },
            { name: 'company', type: 'text', label: 'Empresa' },
            {
              name: 'phone',
              type: 'text',
              label: 'Telefone',
              validate: (value: unknown, { siblingData }: { siblingData?: { email?: string } }) => {
                if (!value && !siblingData?.email) return 'Informe telefone ou e-mail.'
                if (value && !/^\+[1-9]\d{7,14}$/.test(String(value))) return 'Use um número com DDD; o CMS normaliza para E.164.'
                return true
              },
            },
            { name: 'email', type: 'email', label: 'E-mail' },
            { name: 'city', type: 'text', label: 'Cidade' },
            { name: 'state', type: 'text', label: 'Estado' },
            { name: 'normalizedPhone', type: 'text', label: 'Telefone normalizado', index: true, admin: { hidden: true } },
            { name: 'normalizedEmail', type: 'text', label: 'E-mail normalizado', index: true, admin: { hidden: true } },
          ],
        },
        {
          label: 'Relacionamento',
          fields: [
            {
              name: 'status',
              type: 'select',
              label: 'Status do cliente',
              defaultValue: 'active',
              index: true,
              options: [
                { label: 'Ativo', value: 'active' },
                { label: 'Em acompanhamento', value: 'follow_up' },
                { label: 'Inativo', value: 'inactive' },
                { label: 'Arquivado', value: 'archived' },
              ],
            },
            {
              name: 'origin',
              type: 'select',
              label: 'Origem',
              index: true,
              options: [...customerOriginOptions],
            },
            businessUserRelationship('owner', 'Responsável'),
            { name: 'sourceLead', type: 'relationship', relationTo: 'leads', label: 'Lead de origem' },
            {
              name: 'interestProfile',
              type: 'group',
              label: 'Perfil de interesse',
              fields: [
                { name: 'categories', type: 'relationship', relationTo: 'categories', hasMany: true, label: 'Categorias de interesse' },
                {
                  name: 'materials',
                  type: 'array',
                  label: 'Materiais de interesse',
                  fields: [{ name: 'value', type: 'text', label: 'Material', required: true }],
                },
                { name: 'investmentMinCents', type: 'number', label: 'Investimento mínimo em centavos', min: 0 },
                { name: 'investmentMaxCents', type: 'number', label: 'Investimento máximo em centavos', min: 0 },
              ],
            },
            {
              name: 'preferences',
              type: 'array',
              label: 'Preferências gerais',
              fields: [{ name: 'value', type: 'text', label: 'Preferência', required: true }],
            },
            {
              name: 'tags',
              type: 'array',
              label: 'Tags',
              fields: [{ name: 'value', type: 'text', label: 'Tag', required: true }],
            },
            { name: 'relationshipNotes', type: 'textarea', label: 'Notas do relacionamento' },
            { name: 'mergedInto', type: 'relationship', relationTo: 'customers', label: 'Mesclado em', admin: { readOnly: true, condition: (_, siblingData) => siblingData?.status === 'archived' } },
            { name: 'mergedAt', type: 'date', label: 'Mesclado em', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' }, condition: (_, siblingData) => siblingData?.status === 'archived' } },
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
                readOnly: true,
                condition: (_, siblingData) => siblingData?.marketingConsent === true,
                date: { pickerAppearance: 'dayAndTime' },
              },
            },
            {
              name: 'consentWithdrawnAt',
              type: 'date',
              label: 'Consentimento retirado em',
              admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
            },
            {
              name: 'privacyRequestStatus',
              type: 'select',
              label: 'Solicitação LGPD',
              defaultValue: 'none',
              index: true,
              access: { update: adminField },
              options: [
                { label: 'Nenhuma', value: 'none' },
                { label: 'Solicitada', value: 'requested' },
                { label: 'Em análise', value: 'reviewing' },
                { label: 'Bloqueada por obrigação', value: 'blocked' },
                { label: 'Concluída', value: 'completed' },
              ],
            },
            {
              name: 'privacyRequestAt',
              type: 'date',
              label: 'Solicitação registrada em',
              admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
            },
            {
              name: 'privacyRequestCompletedAt',
              type: 'date',
              label: 'Solicitação concluída em',
              admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
            },
            {
              name: 'retentionReviewAt',
              type: 'date',
              label: 'Revisar retenção em',
              access: { update: adminField },
              admin: { date: { pickerAppearance: 'dayAndTime' } },
            },
            { name: 'processingRestricted', type: 'checkbox', label: 'Tratamento restrito', defaultValue: false, access: { update: adminField } },
            { name: 'dataHandlingNotes', type: 'textarea', label: 'Observações de privacidade' },
          ],
        },
      ],
    },
  ],
}
