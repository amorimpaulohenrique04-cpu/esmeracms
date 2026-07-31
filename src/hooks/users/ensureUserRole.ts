import { ValidationError, type CollectionBeforeValidateHook } from 'payload'

import type { EsmeraRole } from '../../access/roles'

export function createdUserRole(existingUsers: number, requestedRole?: EsmeraRole | null): EsmeraRole {
  if (existingUsers === 0) return 'admin'
  return requestedRole || 'editor'
}

export const ensureUserRole: CollectionBeforeValidateHook = async ({ data, operation, originalDoc, req }) => {
  if (!data) return data

  if (operation === 'create') {
    const existing = await req.payload.count({ collection: 'users', overrideAccess: true, req })
    data.role = createdUserRole(existing.totalDocs, data.role as EsmeraRole | null | undefined)
  }

  if (operation === 'update' && !data.role && !originalDoc?.role) {
    throw new ValidationError({
      collection: 'users',
      id: originalDoc?.id,
      req,
      errors: [{ path: 'role', message: 'Todo usuário deve possuir um papel explícito.' }],
    })
  }

  return data
}
