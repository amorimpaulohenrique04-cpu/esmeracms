import type { Access, FieldAccess } from 'payload'

export type EsmeraRole = 'admin' | 'editor' | 'commercial'

type RoleUser = {
  id?: number | string
  role?: EsmeraRole | null
}

/**
 * Existing users created before RBAC was introduced have no role saved.
 * They are treated as administrators for backwards compatibility.
 */
export function roleOf(user: unknown): EsmeraRole | null {
  if (!user || typeof user !== 'object') return null
  const role = (user as RoleUser).role
  return role || 'admin'
}

export function canManageSite(user: unknown) {
  const role = roleOf(user)
  return role === 'admin' || role === 'editor'
}

export function canManageBusiness(user: unknown) {
  const role = roleOf(user)
  return role === 'admin' || role === 'commercial'
}

export function isAdmin(user: unknown) {
  return roleOf(user) === 'admin'
}

type RequestLikeArgs = { req: { user?: unknown } }

export const authenticated = ({ req }: RequestLikeArgs) => Boolean(req.user)

export const siteEditors = ({ req }: RequestLikeArgs) => canManageSite(req.user)

export const commercialUsers = ({ req }: RequestLikeArgs) => canManageBusiness(req.user)

export const admins = ({ req }: RequestLikeArgs) => isAdmin(req.user)

export const ownUserOrAdmin: Access = ({ req }) => {
  if (isAdmin(req.user)) return true
  if (!req.user?.id) return false
  return { id: { equals: req.user.id } }
}

export const adminField: FieldAccess = ({ req }) => isAdmin(req.user)

export const publishedProductsOrAuthenticated: Access = ({ req }) => {
  if (canManageSite(req.user)) return true
  if (req.user) return { _status: { equals: 'published' } }
  return {
    and: [
      { _status: { equals: 'published' } },
      { catalogStatus: { equals: 'active' } },
    ],
  }
}

export const activeCategoriesOrAuthenticated: Access = ({ req }) => {
  if (canManageSite(req.user)) return true
  if (req.user) return { _status: { equals: 'published' } }
  return {
    and: [
      { _status: { equals: 'published' } },
      { status: { equals: 'active' } },
    ],
  }
}

export const publishedGlobalOrAuthenticated = ({ req }: RequestLikeArgs) => {
  if (req.user) return true
  return { _status: { equals: 'published' } }
}
