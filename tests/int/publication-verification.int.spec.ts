import { describe, expect, it } from 'vitest'

import {
  assertPublicationVerificationConfigured,
  getPublicationVerificationConfig,
} from '../../src/server/publication/verificationConfig'

const hasDatabase = Boolean(process.env.DATABASE_URL)

describe('publication verification integration contract', () => {
  it('falha antes do publish quando a verificação está desabilitada', () => {
    const config = getPublicationVerificationConfig({
      PUBLICATION_VERIFICATION_ENABLED: 'false',
    } as NodeJS.ProcessEnv)
    expect(() => assertPublicationVerificationConfigured(config)).toThrow(/desativada/i)
  })

  it('exige URL e token do probe', () => {
    const config = getPublicationVerificationConfig({
      PUBLICATION_VERIFICATION_ENABLED: 'true',
      STOREFRONT_PROBE_URL: '',
      ESMERA_RENDERABILITY_TOKEN: '',
    } as NodeJS.ProcessEnv)
    expect(() => assertPublicationVerificationConfigured(config)).toThrow(/URL e o token/i)
  })
})

describe.skipIf(!hasDatabase)('publication verification with Postgres', () => {
  it.todo('Product compatible persiste status e receipt')
  it.todo('Category compatible persiste status e receipt')
  it.todo('mismatch persistente agenda recheck')
  it.todo('incompatible restaura somente com versões ainda idênticas')
  it.todo('Home fica pending e agenda job')
  it.todo('recheck manual não republica')
})
