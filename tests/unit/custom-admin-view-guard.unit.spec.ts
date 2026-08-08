import { describe, expect, it } from 'vitest'

import {
  customAdminLoginURL,
  isPrivateCustomAdminView,
} from '../../src/admin/auth/customViewGuard'

const views = {
  dashboard: { Component: '/admin/Dashboard' },
  products: { Component: '/admin/Products', path: '/products' },
  exactReport: { Component: '/admin/Report', exact: true, path: '/report' },
}

describe('custom admin view auth guard', () => {
  it('guards the custom dashboard before its server component streams', () => {
    expect(isPrivateCustomAdminView(undefined, views)).toBe(true)
    expect(isPrivateCustomAdminView([], views)).toBe(true)
  })

  it('guards custom view paths and non-exact descendants', () => {
    expect(isPrivateCustomAdminView(['products'], views)).toBe(true)
    expect(isPrivateCustomAdminView(['products', 'featured'], views)).toBe(true)
    expect(isPrivateCustomAdminView(['collections', 'products'], views)).toBe(false)
  })

  it('respects exact custom views', () => {
    expect(isPrivateCustomAdminView(['report'], views)).toBe(true)
    expect(isPrivateCustomAdminView(['report', 'daily'], views)).toBe(false)
  })

  it('redirects the dashboard directly to login', () => {
    expect(customAdminLoginURL({
      adminRoute: '/admin',
      loginRoute: '/login',
      searchParams: {},
      segments: undefined,
    })).toBe('/admin/login')
  })

  it('preserves a custom view and its filters as the post-login destination', () => {
    expect(customAdminLoginURL({
      adminRoute: '/admin',
      loginRoute: '/login',
      searchParams: { status: ['active', 'draft'], view: 'grid' },
      segments: ['products'],
    })).toBe('/admin/login?redirect=%2Fadmin%2Fproducts%3Fstatus%3Dactive%26status%3Ddraft%26view%3Dgrid')
  })
})
