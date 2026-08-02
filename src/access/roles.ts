import type { Access, FieldAccess, Where } from 'payload'

export type EsmeraRole = 'admin' | 'editor' | 'commercial'

type RoleUser = {
  id?: number | string
  role?: EsmeraRole | null
}

export function roleOf(user: unknown): EsmeraRole | null {
  if (!user || typeof user !== 'object') return null
  const role = (user as RoleUser).role
  return role === 'admin' || role === 'editor' || role === 'commercial' ? role : null
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

  if (req.user) {
    const publishedOnly: Where = { _status: { equals: 'published' } }
    return publishedOnly
  }

  const publicCatalog: Where = {
    and: [
      { _status: { equals: 'published' } },
      { catalogStatus: { equals: 'active' } },
    ],
  }
  return publicCatalog
}

export const activeCategoriesOrAuthenticated: Access = ({ req }) => {
  if (canManageSite(req.user)) return true

  if (req.user) {
    const publishedOnly: Where = { _status: { equals: 'published' } }
    return publishedOnly
  }

  const publicCategories: Where = {
    and: [
      { _status: { equals: 'published' } },
      { status: { equals: 'active' } },
    ],
  }
  return publicCategories
}

export const publishedGlobalOrAuthenticated = ({ req }: RequestLikeArgs) => {
  if (canManageSite(req.user)) return true
  const publishedOnly: Where = { _status: { equals: 'published' } }
  return publishedOnly
}

export const publishedMediaOrAuthenticated: Access = ({ req }) => {
  if (canManageSite(req.user)) return true
  const publishedOnly: Where = { _status: { equals: 'published' } }
  return publishedOnly
}
