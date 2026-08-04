import type { StorefrontVerification } from './types'
import type { PublicationVerificationConfig } from './verificationConfig'

export type StorefrontProbeInput = {
  entity: 'product' | 'category' | 'home'
  entityId?: string | number
  slug?: string
  expectedRevision: string
  contractVersion: string
  traceId: string
  config?: PublicationVerificationConfig
}

type ProbeResponse = {
  status: 'compatible' | 'incompatible' | 'revision_mismatch' | 'unavailable'
  expectedRevision: string
  observedRevision?: string
  contractVersion: string
  checkedAt: string
  publicUrl?: string
  issues?: Array<{ code: string; path?: string; message: string }>
  retryAfterMs?: number
}

const DEFAULT_TIMEOUT_MS = 5_000

function result(
  input: StorefrontProbeInput,
  status: StorefrontVerification['status'],
  code: string,
  message: string,
  responseReceived = false,
): StorefrontVerification {
  return {
    status,
    expectedRevision: input.expectedRevision,
    contractVersion: input.contractVersion,
    checkedAt: new Date().toISOString(),
    issues: [{ code, message }],
    responseReceived,
  }
}

function isProbeResponse(value: unknown): value is ProbeResponse {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  if (!['compatible', 'incompatible', 'revision_mismatch', 'unavailable'].includes(String(candidate.status))) return false
  if (typeof candidate.expectedRevision !== 'string' || !candidate.expectedRevision) return false
  if (typeof candidate.contractVersion !== 'string' || !candidate.contractVersion) return false
  if (typeof candidate.checkedAt !== 'string' || !candidate.checkedAt) return false
  if (candidate.observedRevision !== undefined && typeof candidate.observedRevision !== 'string') return false
  if (candidate.publicUrl !== undefined && typeof candidate.publicUrl !== 'string') return false
  if (candidate.retryAfterMs !== undefined && (typeof candidate.retryAfterMs !== 'number' || candidate.retryAfterMs < 0)) return false
  if (candidate.issues !== undefined) {
    if (!Array.isArray(candidate.issues)) return false
    if (!candidate.issues.every((issue) => {
      if (!issue || typeof issue !== 'object') return false
      const item = issue as Record<string, unknown>
      return typeof item.code === 'string' && item.code.length > 0 &&
        typeof item.message === 'string' && item.message.length > 0 &&
        (item.path === undefined || typeof item.path === 'string')
    })) return false
  }
  return true
}

export async function probeStorefrontRevision(
  input: StorefrontProbeInput,
): Promise<StorefrontVerification> {
  const endpoint = input.config?.probeURL || process.env.STOREFRONT_PROBE_URL?.trim()
  const token = input.config?.probeToken || process.env.STOREFRONT_PROBE_TOKEN?.trim() || process.env.ESMERA_RENDERABILITY_TOKEN?.trim()
  if (!endpoint || !token) {
    return result(input, 'not_run', 'probe.not_configured', 'O probe da vitrine não está configurado.')
  }

  const configuredTimeout = Number(process.env.STOREFRONT_PROBE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : DEFAULT_TIMEOUT_MS

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        'x-esmera-trace-id': input.traceId,
      },
      body: JSON.stringify({
        kind: input.entity,
        id: input.entityId,
        slug: input.slug,
        expectedRevision: input.expectedRevision,
        contractVersion: input.contractVersion,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (response.status === 401 || response.status === 403) {
      return result(input, 'unavailable', 'probe.auth_failed', 'A credencial do probe foi recusada pela vitrine.', true)
    }

    const body = await response.json().catch(() => null)
    if (
      !isProbeResponse(body) ||
      body.expectedRevision !== input.expectedRevision ||
      body.contractVersion !== input.contractVersion
    ) {
      return result(input, 'unavailable', 'probe.invalid_response', 'A vitrine respondeu com um contrato de verificação inválido.', true)
    }

    return {
      status: body.status,
      expectedRevision: body.expectedRevision,
      observedRevision: body.observedRevision,
      contractVersion: body.contractVersion,
      checkedAt: body.checkedAt,
      publicUrl: body.publicUrl,
      issues: body.issues,
      retryAfterMs: body.retryAfterMs,
      responseReceived: true,
    }
  } catch {
    return result(input, 'unavailable', 'probe.transport_error', 'A vitrine não pôde ser consultada agora.')
  }
}
