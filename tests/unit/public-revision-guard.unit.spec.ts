import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

async function source(relativePath: string) {
  return await fs.readFile(path.join(root, relativePath), 'utf8')
}

describe('guard estático dos caminhos de publicação pública', () => {
  it('Product individual e bulk calculam metadata sobre snapshot pós-publicação', async () => {
    const route = await source('src/app/(payload)/api/admin-products/route.ts')
    const bulk = await source('src/server/publication/bulkPublication.ts')
    for (const code of [route, bulk]) {
      expect(code).toContain('createPublicPublicationMetadata')
      expect(code).toContain("_status: 'published'")
      expect(code).toContain('publicationRevision: metadata.revision')
      expect(code).toContain('publicationContractVersion: metadata.contractVersion')
    }
  })

  it('Category publica com metadata e reorder delega ao helper oficial', async () => {
    const route = await source('src/app/(payload)/api/admin-categories/route.ts')
    expect(route).toContain("createPublicPublicationMetadata('category'")
    expect(route).toContain('stampPublishedDocumentMetadata')
    expect(route).toContain("entity: 'category'")
  })

  it('caminhos legados de Product delegam ao helper oficial', async () => {
    const route = await source('src/app/(payload)/api/admin-products/route.ts')
    expect(route).toContain('stampPublishedDocumentMetadata')
    for (const action of ['archive', 'restore', 'add-category', 'set-availability']) {
      expect(route).toContain(`action === '${action}'`)
    }
  })

  it('Home usa afterChange com bypass de recursão', async () => {
    const home = await source('src/globals/Home.ts')
    const helper = await source('src/server/publication/stampPublicationMetadata.ts')
    expect(home).toContain('afterChange: [stampPublishedHomeMetadata]')
    expect(helper).toContain('skipPublicRevisionStamp')
    expect(helper).toContain('findGlobal')
    expect(helper).toContain('draft: false')
  })

  it('verify permanece desconectado do coordenador', async () => {
    const product = await source('src/app/(payload)/api/admin-products/route.ts')
    const category = await source('src/app/(payload)/api/admin-categories/route.ts')
    const bulk = await source('src/server/publication/bulkPublication.ts')
    expect(`${product}\n${category}\n${bulk}`).not.toContain('verify: probeStorefrontRevision')
  })
})
