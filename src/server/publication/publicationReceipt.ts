import type { Payload, PayloadRequest } from 'payload'

import type { PublicationReceipt } from './types'

function sanitize(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [redacted]')
      .replace(/(?:token|secret|authorization|cookie)\s*[:=]\s*[^\s,;]+/gi, '[redacted]')
  }
  if (Array.isArray(value)) return value.map(sanitize)
  if (!value || typeof value !== 'object') return value
  const source = value as Record<string, unknown>
  const target: Record<string, unknown> = {}
  for (const [key, next] of Object.entries(source)) {
    if (/token|authorization|cookie/i.test(key)) continue
    target[key] = sanitize(next)
  }
  return target
}

export async function persistPublicationReceipt(
  payload: Payload,
  receipt: PublicationReceipt,
  req?: PayloadRequest,
): Promise<void> {
  const safe = sanitize(receipt) as PublicationReceipt
  await payload.create({
    collection: 'publication-receipts' as never,
    overrideAccess: true,
    req,
    data: {
      traceId: safe.traceId,
      parentTraceId: safe.parentTraceId || null,
      operation: safe.operation,
      source: safe.source,
      entity: safe.entity,
      documentId: String(safe.documentId),
      actorId: String(safe.actorId),
      expectedRevision: safe.expectedRevision || null,
      savedRevision: safe.savedRevision || null,
      publishedRevision: safe.publishedRevision || null,
      previousPublishedRevision: safe.previousPublishedRevision || null,
      previousEditorialRevision: safe.previousEditorialRevision || null,
      observedRevision: safe.observedRevision || null,
      previousVersionId: safe.previousVersionId === undefined ? null : String(safe.previousVersionId),
      status: safe.status,
      verificationStatus: safe.verificationStatus || null,
      contractVersion: safe.contractVersion || null,
      retryable: safe.retryable,
      verificationAttempts: safe.verificationAttempts,
      rollback: safe.rollback || null,
      issues: safe.issues || [],
      startedAt: safe.startedAt,
      completedAt: safe.completedAt,
      durationMs: safe.durationMs,
    } as never,
  } as never)
}
