import { describe, expect, it } from 'vitest'

import { canonicalStorefrontQuery } from '../../src/server/storefront-v2/cacheKey'

describe('storefront cache key', () => {
  it('drops unknown query parameters that do not affect the public contract', () => {
    const params = new URLSearchParams(
      'limit=24&page=1&sort=editorial&utm_source=instagram&_vercel_share=secret',
    )
    expect(canonicalStorefrontQuery(params)).toBe(
      'page=1&limit=24&sort=editorial',
    )
  })

  it('normalizes public key order while preserving repeated filter values', () => {
    const params = new URLSearchParams(
      'material=esmeralda&sort=name_asc&material=metal&page=2&q=vaso',
    )
    expect(canonicalStorefrontQuery(params)).toBe(
      'page=2&sort=name_asc&q=vaso&material=esmeralda&material=metal',
    )
  })
})
