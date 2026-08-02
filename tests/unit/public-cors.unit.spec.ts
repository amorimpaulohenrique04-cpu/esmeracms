import { describe, expect, it } from 'vitest'

import { parseDecoCorsOrigins } from '@/server/env/cors'

describe('deco CORS allowlist', () => {
  it('keeps CORS closed when server-side loaders need no browser origin', () => {
    expect(parseDecoCorsOrigins(undefined)).toEqual([])
    expect(parseDecoCorsOrigins('  ')).toEqual([])
  })

  it('accepts, normalizes and de-duplicates exact deco origins', () => {
    expect(parseDecoCorsOrigins('https://store.deco.site, https://admin.deco.cx, https://store.deco.site/')).toEqual([
      'https://store.deco.site',
      'https://admin.deco.cx',
    ])
  })

  it.each([
    'https://*.deco.site',
    'http://store.deco.site',
    'https://store.deco.site/path',
    'https://example.com',
  ])('rejects unsafe or unrelated origin %s', (origin) => {
    expect(() => parseDecoCorsOrigins(origin)).toThrow()
  })
})
