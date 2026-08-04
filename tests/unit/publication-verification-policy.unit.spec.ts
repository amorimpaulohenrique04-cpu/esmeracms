import { describe, expect, it, vi } from 'vitest'

import { verifyPublicationWithRetry } from '../../src/server/publication/verificationPolicy'
import type { StorefrontVerification } from '../../src/server/publication/types'

function verification(status: StorefrontVerification['status'], observedRevision?: string): StorefrontVerification {
  return {
    status,
    expectedRevision: 'expected',
    observedRevision,
    contractVersion: '1',
    checkedAt: '2026-08-04T06:00:00.000Z',
    responseReceived: status !== 'not_run' && status !== 'unavailable',
  }
}

describe('verifyPublicationWithRetry', () => {
  it('compatible encerra na primeira tentativa', async () => {
    const verify = vi.fn(async () => verification('compatible', 'expected'))
    const sleep = vi.fn(async () => undefined)
    const result = await verifyPublicationWithRetry({ verify, sleep })
    expect(result.verification.status).toBe('compatible')
    expect(result.attempts).toHaveLength(1)
    expect(sleep).not.toHaveBeenCalled()
    expect(result.retryable).toBe(false)
  })

  it('incompatible nunca recebe retry curto', async () => {
    const verify = vi.fn(async () => verification('incompatible', 'expected'))
    const sleep = vi.fn(async () => undefined)
    const result = await verifyPublicationWithRetry({ verify, sleep })
    expect(result.verification.status).toBe('incompatible')
    expect(verify).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('mismatch transitório torna-se compatible após retry', async () => {
    const responses = [verification('revision_mismatch', 'old'), verification('compatible', 'expected')]
    const verify = vi.fn(async () => responses.shift() as StorefrontVerification)
    const sleep = vi.fn(async () => undefined)
    const result = await verifyPublicationWithRetry({ verify, sleep })
    expect(result.verification.status).toBe('compatible')
    expect(result.attempts).toHaveLength(2)
    expect(sleep).toHaveBeenCalledWith(500)
  })

  it('mismatch persistente usa 500/1500/3000 e permanece retryable', async () => {
    const verify = vi.fn(async () => verification('revision_mismatch', 'old'))
    const sleep = vi.fn(async () => undefined)
    const result = await verifyPublicationWithRetry({ verify, sleep })
    expect(result.verification.status).toBe('revision_mismatch')
    expect(verify).toHaveBeenCalledTimes(4)
    expect(sleep.mock.calls.map(([delay]: [number]) => delay)).toEqual([500, 1_500, 3_000])
    expect(result.retryable).toBe(true)
    expect(result.cause).toBe('revision_mismatch')
  })

  it('unavailable de configuração não recebe retry', async () => {
    const verify = vi.fn(async () => ({
      ...verification('unavailable'),
      issues: [{ code: 'probe.not_configured', message: 'não configurado' }],
    }))
    const result = await verifyPublicationWithRetry({ verify, sleep: vi.fn(async () => undefined) })
    expect(result.attempts).toHaveLength(1)
    expect(result.retryable).toBe(false)
  })

  it('not_run nunca vira sucesso', async () => {
    const result = await verifyPublicationWithRetry({ verify: async () => verification('not_run') })
    expect(result.verification.status).toBe('not_run')
    expect(result.retryable).toBe(false)
  })
})
