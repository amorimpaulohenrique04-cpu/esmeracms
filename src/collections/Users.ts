import type { CollectionConfig } from 'payload'

import { adminField, admins, isAdmin, ownUserOrAdmin } from '../access/roles'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: 'Usuário',
    plural: 'Usuários',
  },
  admin: {
    useAsTitle: 'email',
    group: 'Sistema',
    defaultColumns: ['email', 'role', 'updatedAt'],
  },
  auth: true,
  hooks: {
    beforeValidate: [
      async ({ data, operation, req }) => {
        if (!data) return data
        // Bootstrap seguro: apenas o primeiro usuário de uma instalação vazia nasce admin.
        if (operation === 'create') {
          const existing = await req.payload.count({ collection: 'users', overrideAccess: true })
          if (existing.totalDocs === 0) data.role = 'admin'
        }
        return data
      },
    ],
  },
  access: {
    admin: ({ req }) => Boolean(req.user),
    create: async ({ req }) => {
      if (isAdmin(req.user)) return true
      const existing = await req.payload.count({ collection: 'users', overrideAccess: true })
      return existing.totalDocs === 0
    },
    read: ownUserOrAdmin,
    update: ownUserOrAdmin,
    delete: admins,
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      label: 'Papel',
      required: true,
      defaultValue: 'editor',
      saveToJWT: true,
      options: [
        { label: 'Administrador', value: 'admin' },
        { label: 'Editorial', value: 'editor' },
        { label: 'Comercial', value: 'commercial' },
      ],
      access: {
        update: adminField,
      },
      admin: {
        position: 'sidebar',
        description: 'Controla o acesso às áreas editorial e comercial. Usuários sem papel explícito não recebem privilégios.',
      },
    },
    {
      name: 'name',
      type: 'text',
      label: 'Nome',
    },
  ],
}
