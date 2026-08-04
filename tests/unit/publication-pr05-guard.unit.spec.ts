import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
async function source(relative: string) { return await fs.readFile(path.join(root, relative), 'utf8') }

describe('PR-05 static guards', () => {
  it('Product e Category conectam callbacks obrigatórios do coordenador', async () => {
    const product = await source('src/app/(payload)/api/admin-products/route.ts')
    const category = await source('src/app/(payload)/api/admin-categories/route.ts')
    for (const file of [product, category]) {
      expect(file).toContain('verificationConfig: runtime.verificationConfig')
      expect(file).toContain('verify: runtime.verify')
      expect(file).toContain('persistOperationalState: runtime.persistOperationalState')
      expect(file).toContain('createReceipt: runtime.createReceipt')
      expect(file).toContain('scheduleRecheck: runtime.scheduleRecheck')
      expect(file).toContain('skipPublicationVerification: true')
    }
  })

  it('Home usa hook protegido e agenda verificação', async () => {
    const home = await source('src/globals/Home.ts')
    const stamp = await source('src/server/publication/stampPublicationMetadata.ts')
    expect(home).toContain('stampPublishedHomeMetadata')
    expect(stamp).toContain('skipPublicationVerification')
    expect(stamp).toContain("publicationOperationalStatus: 'pending_verification'")
    expect(stamp).toContain('queuePublicationRecheck')
  })

  it('campos operacionais não participam da revisão editorial', async () => {
    const revision = await source('src/server/publication/revision.ts')
    for (const field of [
      'publicationOperationalStatus',
      'publicationVerificationStatus',
      'publicationVerifiedAt',
      'publicationTraceId',
    ]) expect(revision).toContain(`'${field}'`)
  })

  it('token não é persistido no receipt nem logado pelo probe', async () => {
    const receipt = await source('src/server/publication/publicationReceipt.ts')
    const probe = await source('src/server/publication/storefrontProbe.ts')
    expect(receipt).not.toContain('probeToken:')
    expect(probe).not.toContain('console.log')
    expect(probe).not.toContain('console.error')
  })
})
