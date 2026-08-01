import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

type MatrixItem = {
  id: string
  file: string
  evidence: string
}

const requiredIds = [
  'login-by-role',
  'role-aware-sidebar',
  'create-product-draft',
  'complete-product',
  'publish-product',
  'find-published-product',
  'category-reorder-drag',
  'category-reorder-accessible',
  'create-customer',
  'detect-customer-duplicate',
  'create-opportunity',
  'move-pipeline',
  'win-opportunity',
  'see-created-sale',
  'deliver-sale',
  'see-after-sale-task',
  'complete-follow-up',
  'filter-reports',
  'reload-preserving-filters',
  'share-report-url',
  'open-shared-url',
  'enter-technical-admin',
  'return-with-context',
] as const

describe('Stage 20 mandatory E2E matrix', () => {
  it('keeps every required acceptance flow linked to executable evidence', async () => {
    const matrixPath = path.resolve('tests/stage20-matrix.json')
    const matrix = JSON.parse(await fs.readFile(matrixPath, 'utf8')) as MatrixItem[]
    const ids = matrix.map((item) => item.id)

    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.sort()).toEqual([...requiredIds].sort())

    for (const item of matrix) {
      const filePath = path.resolve(item.file)
      const source = await fs.readFile(filePath, 'utf8')
      expect(source, `${item.id} must keep its declared evidence in ${item.file}`).toContain(item.evidence)
    }
  })
})
