import type { Payload, PayloadRequest } from 'payload'

import { attemptConditionalPublicationRollback } from './conditionalRollback'
import { persistPublicationReceipt } from './publicationReceipt'
import { queuePublicationRecheck } from './publicationJobs'
import { createPublicPublicationMetadata } from './publicRevision'
import { createDocumentRevision } from './revision'
import { probeStorefrontRevision } from './storefrontProbe'
import { getPublicationVerificationConfig } from './verificationConfig'
import type {
  ConditionalRollbackResult,
  PersistedPublicationState,
  PublicationReceipt,
  PublicationReceiptSource,
  PublicationRecheckInput,
  PublishedVersionSnapshot,
  VerifiablePublicationEntity,
} from './types'

type RuntimeCollection = 'products' | 'categories'
type PublicDocument = Record<string, unknown>

type VersionRow = {
  id: string | number
  autosave?: boolean | null
  version?: PublicDocument | null
}

function record(value: unknown): PublicDocument | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as PublicDocument
    : null
}

function userID(user: PayloadRequest['user'] | null | undefined) {
  const id = user && typeof user === 'object' ? (user as { id?: unknown }).id : null
  return typeof id === 'string' || typeof id === 'number' ? id : 'system'
}

function metadataOf(document: unknown) {
  const source = record(document)
  const publicationRevision = typeof source?.publicationRevision === 'string'
    ? source.publicationRevision
    : ''
  const publicationContractVersion = typeof source?.publicationContractVersion === 'string'
    ? source.publicationContractVersion
    : ''
  if (!publicationRevision || !publicationContractVersion) {
    throw new Error('O documento publicado não contém publicationRevision e publicationContractVersion válidas.')
  }
  return { publicationRevision, publicationContractVersion }
}

async function publishedDocument(
  payload: Payload,
  collection: RuntimeCollection,
  id: string | number,
  user: PayloadRequest['user'] | null | undefined,
  req?: PayloadRequest,
) {
  return await payload.findByID({
    collection,
    id,
    depth: 2,
    draft: false,
    overrideAccess: true,
    user: user || undefined,
    req,
  } as never) as unknown as PublicDocument
}

async function capturePublishedVersion(
  payload: Payload,
  collection: RuntimeCollection,
  id: string | number,
  user: PayloadRequest['user'] | null | undefined,
): Promise<PublishedVersionSnapshot<PublicDocument> | null> {
  const page = await payload.findVersions({
    collection,
    depth: 2,
    limit: 25,
    page: 1,
    sort: '-createdAt',
    where: { parent: { equals: id } } as never,
    overrideAccess: true,
    user: user || undefined,
    showHiddenFields: true,
  } as never) as unknown as { docs?: VersionRow[] }

  for (const row of page.docs || []) {
    const document = record(row.version)
    if (!document || row.autosave === true || document._status !== 'published') continue
    const publicationRevision = typeof document.publicationRevision === 'string'
      ? document.publicationRevision
      : ''
    if (!publicationRevision) continue
    return {
      versionId: row.id,
      document,
      publicationRevision,
      editorialRevision: createDocumentRevision(document),
    }
  }
  return null
}

export function createPayloadPublicationRuntime(input: {
  payload: Payload
  user?: PayloadRequest['user'] | null
  req?: PayloadRequest
  entity: Extract<VerifiablePublicationEntity, 'product' | 'category'>
  collection: RuntimeCollection
  id: string | number
  source: PublicationReceiptSource
}) {
  const { payload, collection, entity, id, user, req, source } = input
  const verificationConfig = getPublicationVerificationConfig()
  const actorId = userID(user)

  async function persistOperationalState(state: PersistedPublicationState) {
    await payload.update({
      collection,
      id,
      draft: false,
      depth: 2,
      overrideAccess: true,
      user: user || undefined,
      req,
      context: {
        skipPublicRevisionStamp: true,
        skipPublicationVerification: true,
      },
      data: {
        publicationOperationalStatus: state.operationalStatus,
        publicationVerificationStatus: state.verificationStatus,
        publicationVerifiedAt: state.verifiedAt,
        publicationTraceId: state.traceId,
      } as never,
    } as never)
  }

  async function restorePreviousVersion(versionId: string | number) {
    await payload.restoreVersion({
      collection,
      id: versionId,
      depth: 2,
      overrideAccess: true,
      user: user || undefined,
      showHiddenFields: true,
      context: {
        publicationRollback: true,
        skipPublicRevisionStamp: true,
        skipPublicationVerification: true,
      },
    } as never)

    const restored = await publishedDocument(payload, collection, id, user, req)
    const calculated = createPublicPublicationMetadata(entity, restored)
    if (
      restored.publicationRevision !== calculated.revision ||
      restored.publicationContractVersion !== calculated.contractVersion
    ) {
      await payload.update({
        collection,
        id,
        draft: false,
        depth: 2,
        overrideAccess: true,
        user: user || undefined,
        req,
        context: {
          publicationRollback: true,
          skipPublicRevisionStamp: true,
          skipPublicationVerification: true,
        },
        data: {
          publicationRevision: calculated.revision,
          publicationContractVersion: calculated.contractVersion,
        } as never,
      } as never)
    }
    return await publishedDocument(payload, collection, id, user, req)
  }

  return {
    actorId,
    source,
    verificationConfig,
    readPublishedBefore: () => capturePublishedVersion(payload, collection, id, user),
    extractPublicMetadata: metadataOf,
    verify: async (
      document: PublicDocument,
      metadata: {
        publicationRevision: string
        publicationContractVersion: string
        traceId: string
      },
    ) => probeStorefrontRevision({
      entity,
      entityId: id,
      slug: typeof document.slug === 'string' ? document.slug : undefined,
      expectedRevision: metadata.publicationRevision,
      contractVersion: metadata.publicationContractVersion,
      traceId: metadata.traceId,
      config: verificationConfig,
    }),
    persistOperationalState,
    attemptRollback: async (rollbackInput: {
      enabled: boolean
      previous: PublishedVersionSnapshot<PublicDocument> | null
      currentDocument: PublicDocument
      currentPublicationRevision: string
      currentEditorialRevision: string
    }): Promise<ConditionalRollbackResult<PublicDocument>> => attemptConditionalPublicationRollback({
      ...rollbackInput,
      readCurrent: () => publishedDocument(payload, collection, id, user, req),
      restorePrevious: restorePreviousVersion,
      readRestored: () => publishedDocument(payload, collection, id, user, req),
      extractPublicRevision: (document) => {
        const revision = record(document)?.publicationRevision
        return typeof revision === 'string' ? revision : null
      },
      createEditorialRevision: createDocumentRevision,
      verifyRestored: async (document, expectedRevision) => {
        const metadata = metadataOf(document)
        return await probeStorefrontRevision({
          entity,
          entityId: id,
          slug: typeof document.slug === 'string' ? document.slug : undefined,
          expectedRevision,
          contractVersion: metadata.publicationContractVersion,
          traceId: String(document.publicationTraceId || 'rollback'),
          config: verificationConfig,
        })
      },
    }),
    createReceipt: (receipt: PublicationReceipt) => persistPublicationReceipt(payload, receipt, req),
    scheduleRecheck: (recheck: PublicationRecheckInput) => queuePublicationRecheck(payload, recheck),
  }
}
