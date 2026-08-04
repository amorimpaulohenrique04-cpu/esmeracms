import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()
const source = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('Rodada 3 — interatividade avançada', () => {
  it('mantém View Transition API como progressive enhancement com reduced motion', () => {
    const css = source('src/admin/design-system/advanced-interactions.scss')
    expect(css).toContain('@view-transition')
    expect(css).toContain('navigation: auto')
    expect(css).toContain('120ms')
    expect(css).toContain('220ms')
    expect(css).toContain('prefers-reduced-motion: reduce')
    expect(css).toContain('navigation: none')
  })

  it('não preserva módulos experimentais sem consumidor real', () => {
    expect(existsSync(resolve(root, 'src/admin/editorial/EditorialPreview.tsx'))).toBe(false)
    expect(existsSync(resolve(root, 'src/admin/editorial/previewURL.ts'))).toBe(false)
    expect(existsSync(resolve(root, 'src/admin/modules/reports/investigation.ts'))).toBe(false)

    const reconciliation = source('docs/pr20-reconciliation.md')
    expect(reconciliation).toContain('nunca foi conectado a um entry point')
    expect(reconciliation).toContain('helper desconectado foi removido')
  })

  it('expõe somente ações contextuais com rotas reais na command palette', () => {
    const route = source('src/app/(payload)/api/admin-search/route.ts')
    expect(route).toContain('contextualActions')
    expect(route).toContain('Nova categoria')
    expect(route).toContain('Novo follow-up')
    expect(route).toContain('/admin/collections/tasks/create?type=follow_up')
    expect(route).toContain('Copiar recorte atual')
    expect(route).not.toContain('mutation: undefined')
  })

  it('não adiciona biblioteca de motion à Rodada 3', () => {
    const packageJSON = source('package.json')
    expect(packageJSON).not.toContain('"motion"')
    expect(packageJSON).not.toContain('"framer-motion"')
  })
})
