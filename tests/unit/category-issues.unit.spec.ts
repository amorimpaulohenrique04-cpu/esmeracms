import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import {
  collectCategoryHierarchyIssues,
  getCategoryHierarchyIssues,
} from '../../src/businessRules/categories/hierarchy'
import { decorateIssues } from '../../src/issues/build'
import { allIssueCodes, ISSUE_CODES } from '../../src/issues/codes'
import type { IssueCopyCatalog } from '../../src/issues/copy'
import {
  assessCategoryPublication,
  collectCategoryReadinessIssues,
} from '../../src/server/publication/categoryAssessment'

/** `findByID` falso: devolve o pai declarado no mapa ou lança (categoria ausente). */
function reqWithTree(tree: Record<string, string | number | null>): PayloadRequest {
  return {
    payload: {
      findByID: vi.fn(async ({ id }: { id: string | number }) => {
        const key = String(id)
        if (!(key in tree)) throw new Error('not found')
        return { id, parent: tree[key] }
      }),
    },
  } as unknown as PayloadRequest
}

describe('readiness de categoria — issues tipadas', () => {
  it('emite código, path, aba, rótulo e âncora estáveis', () => {
    const issues = assessCategoryPublication({ id: 5, title: '', slug: '' }).issues
    const byCode = new Map(issues.map((issue) => [issue.code, issue]))

    expect(byCode.get(ISSUE_CODES.categoryTitleMissing)).toMatchObject({
      path: 'title', tab: 'content', anchor: 'category-title', label: 'Nome', source: 'readiness',
    })
    expect(byCode.get(ISSUE_CODES.categorySlugMissing)).toMatchObject({
      path: 'slug', tab: 'content', anchor: 'category-slug', source: 'readiness',
    })
  })

  it('detecta auto-referência com código próprio', () => {
    const issues = collectCategoryReadinessIssues({ id: 5, title: 'Anéis', slug: 'aneis', parent: 5 })
    expect(issues.map((issue) => issue.code)).toContain(ISSUE_CODES.categoryParentSelfReference)
  })

  it('a decisão não carrega copy', () => {
    const permitted = new Set(['code', 'severity', 'path', 'source', 'params'])
    const raws = collectCategoryReadinessIssues({ id: 5, title: '', slug: '', parent: 5 })

    expect(raws.length).toBeGreaterThan(0)
    for (const raw of raws) {
      for (const key of Object.keys(raw)) expect(permitted.has(key)).toBe(true)
    }
  })

  it('trocar a copy não altera código, path nem readiness (ERR-U02)', () => {
    const stubCatalog: IssueCopyCatalog = Object.fromEntries(
      allIssueCodes.map((code) => [code, { message: () => 'ZZZ' }]),
    )
    const raws = collectCategoryReadinessIssues({ id: 5, title: '', slug: '' })
    const real = decorateIssues(raws, 'category')
    const stubbed = decorateIssues(raws, 'category', stubCatalog)

    expect(stubbed.map((i) => [i.code, i.path, i.tab, i.severity]))
      .toEqual(real.map((i) => [i.code, i.path, i.tab, i.severity]))
    expect(stubbed.every((i) => i.message === 'ZZZ')).toBe(true)
  })

  it('uma categoria completa fica pronta', () => {
    const assessment = assessCategoryPublication({
      id: 5,
      title: 'Anéis',
      slug: 'aneis',
      status: 'active',
      _status: 'published',
    })
    expect(assessment.ready).toBe(true)
    expect(assessment.issues).toEqual([])
  })
})

describe('hierarquia de categorias — cada condição tem código próprio', () => {
  it('sem pai não há pendência', async () => {
    expect(await collectCategoryHierarchyIssues(reqWithTree({}), 1, null)).toEqual([])
  })

  it('auto-referência', async () => {
    const issues = await collectCategoryHierarchyIssues(reqWithTree({}), 1, 1)
    expect(issues.map((i) => i.code)).toEqual([ISSUE_CODES.categoryParentSelfReference])
  })

  it('ciclo criado pelo novo pai', async () => {
    // 1 → 2 → 3 → 1: escolher 2 como pai de 1 fecha o ciclo.
    const issues = await collectCategoryHierarchyIssues(reqWithTree({ 2: 3, 3: 1, 1: null }), 1, 2)
    expect(issues.map((i) => i.code)).toEqual([ISSUE_CODES.categoryParentCycle])
  })

  it('ciclo já existente na árvore', async () => {
    const issues = await collectCategoryHierarchyIssues(reqWithTree({ 2: 3, 3: 2 }), 9, 2)
    expect(issues.map((i) => i.code)).toEqual([ISSUE_CODES.categoryHierarchyExistingCycle])
  })

  it('pai inexistente', async () => {
    const issues = await collectCategoryHierarchyIssues(reqWithTree({}), 1, 42)
    expect(issues.map((i) => i.code)).toEqual([ISSUE_CODES.categoryParentNotFound])
  })

  it('profundidade acima do limite seguro', async () => {
    const deep: Record<string, number | null> = {}
    for (let level = 1; level <= 150; level += 1) deep[String(level)] = level + 1
    const issues = await collectCategoryHierarchyIssues(reqWithTree(deep), 9999, 1)
    expect(issues.map((i) => i.code)).toEqual([ISSUE_CODES.categoryHierarchyDepthExceeded])
  })

  it('as cinco condições apontam para o campo parent com aba e âncora resolvidas', async () => {
    const issues = await getCategoryHierarchyIssues(reqWithTree({}), 1, 1)
    expect(issues[0]).toMatchObject({
      path: 'parent',
      tab: 'content',
      anchor: 'category-parent',
      label: 'Categoria principal',
      severity: 'blocker',
      source: 'readiness',
    })
    // Antes: cinco strings indistinguíveis, concatenadas num APIError sem path.
    expect(issues[0].message).toBeTruthy()
  })
})
