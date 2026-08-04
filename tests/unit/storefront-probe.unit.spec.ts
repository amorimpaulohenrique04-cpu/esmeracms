import { afterEach, describe, expect, it, vi } from 'vitest'

import { probeStorefrontRevision } from '../../src/server/publication/storefrontProbe'

const input = {
  entity: 'product' as const,
  entityId: 101,
  expectedRevision: 'a'.repeat(64),
  contractVersion: '1',
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('cliente backend do probe da vitrine', () => {
  it('retorna unavailable quando endpoint ou token não estão configurados', async () => {
    vi.stubEnv('STOREFRONT_PROBE_URL', '')
    vi.stubEnv('STOREFRONT_PROBE_TOKEN', '')
    const result = await probeStorefrontRevision(input)
    expect(result.status).toBe('unavailable')
  })

  it('aceita somente a resposta validada e preserva observedRevision', async () => {
    vi.stubEnv('STOREFRONT_PROBE_URL', 'https://example.com/api/esmera-renderability')
    vi.stubEnv('STOREFRONT_PROBE_TOKEN', 'secret')
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer secret')
      return Response.json({
        status: 'revision_mismatch',
        expectedRevision: input.expectedRevision,
        observedRevision: 'b'.repeat(64),
        contractVersion: input.contractVersion,
        checkedAt: '2026-08-04T12:00:00.000Z',
        issues: [{ code: 'probe.revision_mismatch', message: 'Mismatch.' }],
      })
    }))

    const result = await probeStorefrontRevision(input)
    expect(result.status).toBe('revision_mismatch')
    expect(result.observedRevision).toBe('b'.repeat(64))
  })

  it('rejeita resposta que troca expectedRevision ou contractVersion', async () => {
    vi.stubEnv('STOREFRONT_PROBE_URL', 'https://example.com/api/esmera-renderability')
    vi.stubEnv('STOREFRONT_PROBE_TOKEN', 'secret')
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      status: 'compatible',
      expectedRevision: 'forjada',
      observedRevision: input.expectedRevision,
      contractVersion: input.contractVersion,
      checkedAt: '2026-08-04T12:00:00.000Z',
    })))

    const result = await probeStorefrontRevision(input)
    expect(result.status).toBe('unavailable')
  })

  it('converte falha de rede em unavailable', async () => {
    vi.stubEnv('STOREFRONT_PROBE_URL', 'https://example.com/api/esmera-renderability')
    vi.stubEnv('STOREFRONT_PROBE_TOKEN', 'secret')
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline')
    }))

    const result = await probeStorefrontRevision(input)
    expect(result.status).toBe('unavailable')
  })
})
