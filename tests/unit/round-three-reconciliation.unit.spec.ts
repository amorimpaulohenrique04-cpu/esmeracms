import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('reconciliação da PR 20 com a main', () => {
  it('mantém a fundação atual e oferece preview draft interno autenticado', () => {
    const route = source('src/app/(frontend)/preview/editorial/[kind]/[id]/page.tsx')
    const previewURL = source('src/admin/editorial/previewURL.ts')

    expect(route).toContain('payload.auth')
    expect(route).toContain('canManageSite')
    expect(route).toContain('draft: true')
    expect(route).toContain('overrideAccess: false')
    expect(route).toContain('index: false')
    expect(previewURL).toContain('/preview/editorial/${kind}/')
    expect(previewURL).toContain('NEXT_PUBLIC_EDITORIAL_PREVIEW_URL')
  })

  it('limita o preview interno a produtos e categorias', () => {
    const route = source('src/app/(frontend)/preview/editorial/[kind]/[id]/page.tsx')
    expect(route).toContain("kind !== 'product' && kind !== 'category'")
    expect(route).not.toContain("collection: 'sales'")
    expect(route).not.toContain("collection: 'customers'")
  })
})
