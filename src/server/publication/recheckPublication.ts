import { randomUUID } from 'node:crypto'
import type { Payload, PayloadRequest } from 'payload'

import { createPayloadPublicationRuntime } from './payloadPublicationRuntime'
import { persistPublicationReceipt } from './publicationReceipt'
import { queuePublicationRecheck } from './publicationJobs'
import { probeStorefrontRevision } from './storefrontProbe'
import { getPublicationVerificationConfig } from './verificationConfig'
import { verifyPublicationWithRetry } from './verificationPolicy'
import type {
  ConditionalRollbackResult,
  OperationalPublicationStatus,
  PublicationIssue,
  PublicationReceipt,
  PublicationReceiptSource,
  PublicationRecheckInput,
  PublishedVersionSnapshot,
  StorefrontVerification,
  VerificationAttempt,
  VerifiablePublicationEntity,
} from './types'
import { createDocumentRevision } from './revision'

type PublicDocument = Record<string, unknown>
type ReceiptDocument = {
  previousVersionId?: string | null
  previousPublishedRevision?: string | null
  previousEditorialRevision?: string | null
}

function record(value: unknown): PublicDocument | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as PublicDocument
    : null
}

function actorID(user: PayloadRequest['user'] | null | undefined) {
  const id = user && typeof user === 'object' ? (user as { id?: unknown }).id : null
  return typeof id === 'string' || typeof id === 'number' ? id : 'system'
}

function issueList(verification: StorefrontVerification): PublicationIssue[] {
  return (verification.issues || []).map((issue) => ({
    id: issue.code,
    severity: 'blocker',
    path: issue.path || null,
    message: issue.message,
    suggestion: null,
    source: issue.code.startsWith('probe.') ? 'integration' : 'storefront_contract',
  }))
}

async function readPublicDocument(
  payload: Payload,
  entity: VerifiablePublicationEntity,
  id: string | number,
  user?: PayloadRequest['user'] | null,
  req?: PayloadRequest,
): Promise<PublicDocument | null> {
  if (entity === 'home') {
    return record(await payload.findGlobal({
      slug: 'home',
      draft: false,
      depth: 2,
      overrideAccess: true,
      user: user || undefined,
      req,
    } as never))
  }
  return record(await payload.findByID({
    collection: entity === 'product' ? 'products' : 'categories',
    id,
    draft: false,
    depth: 2,
    overrideAccess: true,
    user: user || undefined,
    req,
  } as never))
}

async function updateState(
  payload: Payload,
  entity: VerifiablePublicationEntity,
  id: string | number,
  state: {
    status: OperationalPublicationStatus
    verification: StorefrontVerification
    traceId: string
  },
  user?: PayloadRequest['user'] | null,
  req?: PayloadRequest,
) {
  const data = {
    publicationOperationalStatus: state.status,
    publicationVerificationStatus: state.verification.status,
    publicationVerifiedAt: state.verification.responseReceived ? state.verification.checkedAt : null,
    publicationTraceId: state.traceId,
  }
  const context = {
    skipPublicRevisionStamp: true,
    skipPublicationVerification: true,
  }

  if (entity === 'home') {
    await payload.updateGlobal({
      slug: 'home',
      data: data as never,
      draft: false,
      overrideAccess: true,
      user: user || undefined,
      req,
      context,
    } as never)
    return
  }

  await payload.update({
    collection: entity === 'product' ? 'products' : 'categories',
    id,
    data: data as never,
    draft: false,
    overrideAccess: true,
    user: user || undefined,
    req,
    context,
  } as never)
}

async function parentReceipt(payload: Payload, traceId: string): Promise<ReceiptDocument | null> {
  const result = await payload.find({
    collection: 'publication-receipts' as never,
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    where: { traceId: { equals: traceId } } as never,
  } as never) as unknown as { docs?: ReceiptDocument[] }
  return result.docs?.[0] || null
}

async function previousSnapshot(
  payload: Payload,
  entity: Extract<VerifiablePublicationEntity, 'product' | 'category'>,
  receipt: ReceiptDocument | null,
  user?: PayloadRequest['user'] | null,
): Promise<PublishedVersionSnapshot<PublicDocument> | null> {
  if (!receipt?.previousVersionId || !receipt.previousPublishedRevision || !receipt.previousEditorialRevision) return null
  const version = await payload.findVersionByID({
    collection: entity === 'product' ? 'products' : 'categories',
    id: receipt.previousVersionId,
    depth: 2,
    overrideAccess: true,
    user: user || undefined,
    showHiddenFields: true,
  } as never) as unknown
  const row = record(version)
  const document = record(row?.version) || row
  if (!document) return null
  return {
    versionId: receipt.previousVersionId,
    document,
    publicationRevision: receipt.previousPublishedRevision,
    editorialRevision: receipt.previousEditorialRevision,
  }
}

function rollbackReceipt(rollback: ConditionalRollbackResult<PublicDocument> | undefined) {
  if (!rollback) return undefined
  return {
    attempted: rollback.attempted,
    status: rollback.status,
    reason: rollback.status === 'skipped' || rollback.status === 'failed' ? rollback.reason : undefined,
    restoredRevision: rollback.status === 'reverted' ? rollback.restoredRevision : undefined,
  }
}

export type PublicationRecheckResult = {
  status: OperationalPublicationStatus | 'obsolete'
  verification?: StorefrontVerification
  traceId: string
  retryable: boolean
  rollback?: ConditionalRollbackResult<PublicDocument>
}

export async function recheckPublication(
  payload: Payload,
  input: PublicationRecheckInput & {
    source: Extract<PublicationReceiptSource, 'scheduled-recheck' | 'manual-recheck'>
    user?: PayloadRequest['user'] | null
    req?: PayloadRequest
    sleep?: (milliseconds: number) => Promise<void>
    now?: () => Date
  },
): Promise<PublicationRecheckResult> {
  const now = input.now || (() => new Date())
  const startedAt = now()
  const traceId = randomUUID()
  const current = await readPublicDocument(payload, input.entity, input.documentId, input.user, input.req)
  const currentRevision = typeof current?.publicationRevision === 'string' ? current.publicationRevision : ''

  if (!current || currentRevision !== input.expectedPublicationRevision) {
    return { status: 'obsolete', traceId, retryable: false }
  }

  const config = getPublicationVerificationConfig()
  const policy = await verifyPublicationWithRetry({
    verify: () => probeStorefrontRevision({
      entity: input.entity,
      entityId: input.documentId,
      slug: typeof current.slug === 'string' ? current.slug : undefined,
      expectedRevision: input.expectedPublicationRevision,
      contractVersion: input.contractVersion,
      traceId,
      config,
    }),
    sleep: input.sleep,
    now,
  })

  let status: OperationalPublicationStatus
  let retryable = policy.retryable
  let rollback: ConditionalRollbackResult<PublicDocument> | undefined
  let finalVerification = policy.verification

  if (policy.verification.status === 'compatible') {
    status = 'published'
    retryable = false
  } else if (policy.verification.status === 'revision_mismatch' || policy.verification.status === 'unavailable') {
    status = 'published_but_unverified'
    retryable = true
  } else if (policy.verification.status === 'incompatible') {
    status = 'published_but_incompatible'
    retryable = false

    if (input.entity !== 'home') {
      const receipt = await parentReceipt(payload, input.parentTraceId)
      const previous = await previousSnapshot(payload, input.entity, receipt, input.user)
      const runtime = createPayloadPublicationRuntime({
        payload,
        user: input.user,
        req: input.req,
        entity: input.entity,
        collection: input.entity === 'product' ? 'products' : 'categories',
        id: input.documentId,
        source: input.source,
      })
      rollback = await runtime.attemptRollback({
        enabled: config.rollbackEnabled,
        previous,
        currentDocument: current,
        currentPublicationRevision: currentRevision,
        currentEditorialRevision: createDocumentRevision(current),
      })
      if (rollback.status === 'reverted') {
        finalVerification = rollback.verification || policy.verification
        if (rollback.verification?.status === 'compatible') {
          status = 'publish_reverted'
        } else if (
          rollback.verification?.status === 'unavailable' ||
          rollback.verification?.status === 'revision_mismatch'
        ) {
          status = 'published_but_unverified'
          retryable = true
        } else {
          status = 'publish_reverted'
        }
      }
    }
  } else {
    status = 'failed'
    retryable = false
  }

  await updateState(payload, input.entity, input.documentId, {
    status,
    verification: finalVerification,
    traceId,
  }, input.user, input.req)

  if (status === 'published_but_unverified' && input.stage < 3) {
    await queuePublicationRecheck(payload, {
      entity: input.entity,
      documentId: input.documentId,
      expectedPublicationRevision: rollback?.status === 'reverted'
        ? rollback.restoredRevision
        : input.expectedPublicationRevision,
      contractVersion: input.contractVersion,
      parentTraceId: input.parentTraceId,
      stage: (input.stage + 1) as 2 | 3,
    })
  }

  const completedAt = now()
  const receipt: PublicationReceipt = {
    traceId,
    parentTraceId: input.parentTraceId,
    operation: 'recheck',
    source: input.source,
    entity: input.entity,
    documentId: input.documentId,
    actorId: actorID(input.user),
    publishedRevision: input.expectedPublicationRevision,
    observedRevision: finalVerification.observedRevision,
    status,
    verificationStatus: finalVerification.status,
    contractVersion: input.contractVersion,
    retryable,
    verificationAttempts: policy.attempts as VerificationAttempt[],
    rollback: rollbackReceipt(rollback),
    issues: issueList(finalVerification),
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
  }
  await persistPublicationReceipt(payload, receipt, input.req)

  return { status, verification: finalVerification, traceId, retryable, rollback }
}
