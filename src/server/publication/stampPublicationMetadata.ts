import { randomUUID } from 'node:crypto'
import type { Payload, PayloadRequest } from 'payload'

import { queuePublicationRecheck } from './publicationJobs'
import { persistPublicationReceipt } from './publicationReceipt'
import {
  createPublicPublicationMetadata,
  PublicRevisionProjectionError,
  type PublicRevisionEntity,
} from './publicRevision'
import type { PublicationReceipt } from './types'

type StampableEntity = Extract<PublicRevisionEntity, 'product' | 'category'>
type StampableCollection = 'products' | 'categories'
type PublicDocument = Record<string, unknown>

function record(value: unknown): PublicDocument | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as PublicDocument
    : null
}

function actorID(user: PayloadRequest['user'] | null | undefined) {
  const id = user && typeof user === 'object' ? (user as { id?: unknown }).id : null
  return typeof id === 'string' || typeof id === 'number' ? id : 'system'
}

async function receiptForPending(input: {
  payload: Payload
  req?: PayloadRequest
  traceId: string
  entity: 'product' | 'category' | 'home'
  documentId: string | number
  actorId: string | number
  publicationRevision: string
  contractVersion: string
  source: 'individual' | 'home-hook'
}) {
  const now = new Date().toISOString()
  const receipt: PublicationReceipt = {
    traceId: input.traceId,
    operation: 'publish',
    source: input.source,
    entity: input.entity,
    documentId: input.documentId,
    actorId: input.actorId,
    publishedRevision: input.publicationRevision,
    status: 'pending_verification',
    verificationStatus: 'not_run',
    contractVersion: input.contractVersion,
    retryable: true,
    verificationAttempts: [],
    startedAt: now,
    completedAt: now,
    durationMs: 0,
  }
  await persistPublicationReceipt(input.payload, receipt, input.req)
}

export async function stampPublishedDocumentMetadata(input: {
  payload: Payload
  entity: StampableEntity
  collection: StampableCollection
  id: string | number
  user: PayloadRequest['user']
  document?: unknown
  req?: PayloadRequest
}): Promise<unknown> {
  let published = record(input.document)
  if (!published) {
    published = record(await input.payload.findByID({
      collection: input.collection,
      id: input.id,
      depth: 2,
      draft: false,
      overrideAccess: true,
      user: input.user,
      req: input.req,
    }))
  }
  if (!published || published._status !== 'published') return published

  let metadata: ReturnType<typeof createPublicPublicationMetadata>
  try {
    metadata = createPublicPublicationMetadata(input.entity, published)
  } catch (error) {
    if (!(error instanceof PublicRevisionProjectionError)) throw error
    published = record(await input.payload.findByID({
      collection: input.collection,
      id: input.id,
      depth: 2,
      draft: false,
      overrideAccess: true,
      user: input.user,
      req: input.req,
    }))
    if (!published || published._status !== 'published') return published
    metadata = createPublicPublicationMetadata(input.entity, published)
  }

  const changed = published.publicationRevision !== metadata.revision ||
    published.publicationContractVersion !== metadata.contractVersion
  if (!changed) return published

  const traceId = randomUUID()
  const updated = await input.payload.update({
    collection: input.collection,
    id: input.id,
    data: {
      publicationRevision: metadata.revision,
      publicationContractVersion: metadata.contractVersion,
      publicationOperationalStatus: 'pending_verification',
      publicationVerificationStatus: 'not_run',
      publicationVerifiedAt: null,
      publicationTraceId: traceId,
    } as never,
    draft: false,
    depth: 2,
    overrideAccess: true,
    user: input.user,
    req: input.req,
    context: {
      skipPublicRevisionStamp: true,
      skipPublicationVerification: true,
    },
  })

  await receiptForPending({
    payload: input.payload,
    req: input.req,
    traceId,
    entity: input.entity,
    documentId: input.id,
    actorId: actorID(input.user),
    publicationRevision: metadata.revision,
    contractVersion: metadata.contractVersion,
    source: 'individual',
  })
  await queuePublicationRecheck(input.payload, {
    entity: input.entity,
    documentId: input.id,
    expectedPublicationRevision: metadata.revision,
    contractVersion: metadata.contractVersion,
    parentTraceId: traceId,
    stage: 1,
  })

  return updated
}

export async function stampPublishedHomeMetadata({
  doc,
  req,
}: {
  doc: unknown
  req: PayloadRequest
}): Promise<unknown> {
  const context = (req.context || {}) as Record<string, unknown>
  const current = record(doc)
  if (
    context.skipPublicRevisionStamp ||
    context.skipPublicationVerification ||
    context.publicationRollback ||
    current?._status !== 'published'
  ) return doc

  const publishedHome = record(await req.payload.findGlobal({
    slug: 'home',
    depth: 2,
    draft: false,
    overrideAccess: true,
    req,
  }))
  if (!publishedHome || publishedHome._status !== 'published') return doc

  const metadata = createPublicPublicationMetadata('home', publishedHome)
  const changed = publishedHome.publicationRevision !== metadata.revision ||
    publishedHome.publicationContractVersion !== metadata.contractVersion
  if (!changed) return doc

  const traceId = randomUUID()
  await req.payload.updateGlobal({
    slug: 'home',
    data: {
      publicationRevision: metadata.revision,
      publicationContractVersion: metadata.contractVersion,
      publicationOperationalStatus: 'pending_verification',
      publicationVerificationStatus: 'not_run',
      publicationVerifiedAt: null,
      publicationTraceId: traceId,
    } as never,
    draft: false,
    overrideAccess: true,
    req,
    context: {
      ...context,
      skipPublicRevisionStamp: true,
      skipPublicationVerification: true,
    },
  })

  await receiptForPending({
    payload: req.payload,
    req,
    traceId,
    entity: 'home',
    documentId: 'home',
    actorId: actorID(req.user),
    publicationRevision: metadata.revision,
    contractVersion: metadata.contractVersion,
    source: 'home-hook',
  })
  await queuePublicationRecheck(req.payload, {
    entity: 'home',
    documentId: 'home',
    expectedPublicationRevision: metadata.revision,
    contractVersion: metadata.contractVersion,
    parentTraceId: traceId,
    stage: 1,
  }, { immediate: true })

  return doc
}
