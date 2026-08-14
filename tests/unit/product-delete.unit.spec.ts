import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('Exclusão de produto na aba Produtos', () => {
  it('a rota admin-products suporta a ação delete com access control por-id', () => {
    const route = source('src/app/(payload)/api/admin-products/route.ts')
    expect(route).toContain("| 'delete'")
    expect(route).toContain("action === 'delete'")
    // Exclusão permanente respeitando o access control da collection.
    expect(route).toMatch(/payload\.delete\(\{\s*collection: 'products'[^}]*overrideAccess: false/s)
  })

  it('o workspace expõe exclusão destrutiva em dois cliques (armar → confirmar)', () => {
    const workspace = source('src/admin/modules/products/ProductsWorkspaceClient.tsx')
    expect(workspace).toContain('deleteArmed')
    expect(workspace).toContain('function requestDelete()')
    expect(workspace).toContain('Confirmar exclusão')
    // Botão de perigo aciona a confirmação, e a mutação usa a ação delete.
    expect(workspace).toMatch(/tone="danger"[^>]*onClick=\{requestDelete\}/)
    expect(workspace).toContain("void mutate('delete')")
    // Mudar a seleção desarma a confirmação.
    expect(workspace).toContain('[selectedIds.length]')
  })
})
