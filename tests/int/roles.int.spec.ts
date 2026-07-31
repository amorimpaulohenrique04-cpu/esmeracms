import { describe, expect, it } from 'vitest'

import { canManageBusiness, canManageSite, isAdmin, roleOf } from '../../src/access/roles'

describe('RBAC Esmera', () => {
  it('não transforma usuário sem papel em administrador', () => {
    const user = { id: 1, email: 'legacy@example.com' }
    expect(roleOf(user)).toBeNull()
    expect(isAdmin(user)).toBe(false)
    expect(canManageSite(user)).toBe(false)
    expect(canManageBusiness(user)).toBe(false)
  })

  it('mantém os domínios separados por papel', () => {
    expect(canManageSite({ role: 'editor' })).toBe(true)
    expect(canManageBusiness({ role: 'editor' })).toBe(false)
    expect(canManageBusiness({ role: 'commercial' })).toBe(true)
    expect(canManageSite({ role: 'commercial' })).toBe(false)
  })

  it('administrador continua com acesso aos dois domínios', () => {
    expect(isAdmin({ role: 'admin' })).toBe(true)
    expect(canManageSite({ role: 'admin' })).toBe(true)
    expect(canManageBusiness({ role: 'admin' })).toBe(true)
  })
})
