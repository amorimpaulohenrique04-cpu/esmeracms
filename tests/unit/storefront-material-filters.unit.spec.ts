import { describe, expect, it } from 'vitest'

import {
  readCanonicalMaterialFilters,
  rewriteRequestedMaterialWhere,
} from '../../src/server/storefront-v2/materialFilters'

describe('storefront canonical material filters', () => {
  it('reads repeated public material keys without losing their identity', () => {
    const params = new URLSearchParams('material=esmeralda&material=metal')
    expect(readCanonicalMaterialFilters(params)).toEqual(['esmeralda', 'metal'])
  })

  it('rewrites only the requested material condition to textual matching', () => {
    const where = {
      and: [
        { catalogStatus: { equals: 'active' } },
        { material: { in: ['esmeralda', 'metal'] } },
        { material: { in: ['Bege Bahia natural'] } },
      ],
    }

    expect(rewriteRequestedMaterialWhere(where, ['esmeralda', 'metal'])).toEqual({
      and: [
        { catalogStatus: { equals: 'active' } },
        {
          or: [
            { material: { like: 'esmeralda' } },
            { material: { like: 'metal' } },
            { material: { like: 'metálica' } },
            { material: { like: 'metalica' } },
            { material: { like: 'metálico' } },
            { material: { like: 'metalico' } },
          ],
        },
        { material: { in: ['Bege Bahia natural'] } },
      ],
    })
  })

  it('maps accented canonical aliases used by the public storefront', () => {
    expect(rewriteRequestedMaterialWhere(
      { material: { in: ['calcario', 'bege-bahia'] } },
      ['calcario', 'bege-bahia'],
    )).toEqual({
      or: [
        { material: { like: 'calcário' } },
        { material: { like: 'calcario' } },
        { material: { like: 'Bege Bahia' } },
      ],
    })
  })
})
