import type { Payload, PayloadRequest } from 'payload'

import { coordinatePublication, type PublicationCoordinatorResult } from './coordinator'
import { createPayloadPublicationRuntime } from './payloadPublicationRuntime'
import { assessProductPublication } from './productAssessment'
import { createPublicPublicationMetadata } from './publicRevision'
import {
  PublicationBlockedError,
  RevisionConflictError,
  type BulkPublicationItemResult,
  type BulkPublicationResult,
  type PublicationIssue,
} from './types'

export const BULK_PUBLICATION_LIMIT = 25

type PublicDocument = Record<string, unknown>

export type BulkPublicationItemInput = {
  id: string | number
  expectedUpdatedAt: string
  expectedRevision?: string | null
  confirmationToken?: string | null
}

export type CoordinatorOutcome =
  | { ok: true; result: PublicationCoordinatorResult<unknown> }
  | { ok: false; error: unknown }

export type OutcomeContext = {
  id: string | number
  title?: string
  updatedAt?: string
}

function documentField(document: unknown, field: 'updatedAt' | 'title'): string | undefined {
  if (!document || typeof document !== 'object') return undefined
  const value = (document as Record<string, unknown>)[field]
  return typeof value === 'string' ? value : undefined
}

export function documentUpdatedAt(document: unknown): string | undefined {
  return documentField(document, 'updatedAt')
}

function issuesOfSeverity(issues: PublicationIssue[] | undefined, severity: PublicationIssue['severity']) {
  const matching = (issues || []).filter((issue) => issue.severity === severity)
  return matching.length ? matching : undefined
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

const resultMessages = {
  published: 'Visível no site.',
  published_but_unverified: 'Publicado; confirmação do site pendente.',
  published_but_incompatible: 'Publicado com problema de compatibilidade.',
  publish_reverted: 'Publicação desfeita; versão anterior preservada.',
  failed: 'Não foi possível concluir a publicação.',
} as const

export function mapCoordinatorOutcome(
  outcome: CoordinatorOutcome,
  context: OutcomeContext,
): BulkPublicationItemResult {
  const base = { id: context.id, title: context.title }

  if (outcome.ok) {
    const { result } = outcome

    if (result.status === 'requires_confirmation') {
      return {
        ...base,
        status: 'warning_requires_confirmation',
        message: 'Existem avisos que precisam de confirmação antes de publicar.',
        revision: result.revision,
        updatedAt: context.updatedAt,
        issues: issuesOfSeverity(result.assessment?.issues, 'warning'),
        confirmationToken: result.confirmationToken,
        traceId: result.traceId,
      }
    }

    const status = result.status === 'published' ||
        result.status === 'published_but_unverified' ||
        result.status === 'published_but_incompatible' ||
        result.status === 'publish_reverted'
      ? result.status
      : 'failed'

    return {
      ...base,
      status,
      message: resultMessages[status],
      revision: result.revision,
      publicationRevision: result.publicationRevision,
      traceId: result.traceId,
      retryable: result.retryable,
      updatedAt: documentUpdatedAt(result.document) || context.updatedAt,
      issues: status === 'published_but_incompatible'
        ? result.verification?.issues?.map((issue) => ({
          id: issue.code,
          severity: 'blocker',
          path: issue.path || null,
          message: issue.message,
          suggestion: null,
          source: 'storefront_contract',
        }))
        : undefined,
    }
  }

  const { error } = outcome

  if (error instanceof RevisionConflictError) {
    return {
      ...base,
      status: 'revision_conflict',
      message: errorMessage(error, 'Este conteúdo foi alterado em outra sessão.'),
    }
  }

  if (error instanceof PublicationBlockedError) {
    return {
      ...base,
      status: 'blocked',
      message: 'Existem pendências que impedem a publicação.',
      revision: error.assessment?.revision,
      updatedAt: context.updatedAt,
      issues: issuesOfSeverity(error.assessment?.issues, 'blocker'),
    }
  }

  return {
    ...base,
    status: 'failed',
    message: errorMessage(error, 'Não foi possível publicar o produto.'),
  }
}

async function publishSingleProduct(
  payload: Payload,
  user: PayloadRequest['user'],
  item: BulkPublicationItemInput,
): Promise<BulkPublicationItemResult> {
  let lastCurrent: PublicDocument | null = null
  let lastDraft: PublicDocument | null = null

  const read = async (req?: PayloadRequest): Promise<PublicDocument> => await payload.findByID({
    collection: 'products',
    id: item.id,
    draft: true,
    depth: 2,
    overrideAccess: false,
    user,
    req,
  }) as unknown as PublicDocument

  try {
    const runtime = createPayloadPublicationRuntime({
      payload,
      user,
      entity: 'product',
      collection: 'products',
      id: item.id,
      source: 'bulk',
    })
    const result = await coordinatePublication<PublicDocument, Record<string, unknown>>({
      entity: 'product',
      entityId: item.id,
      actorId: runtime.actorId,
      source: runtime.source,
      data: { _status: 'draft' },
      expectedRevision: item.expectedRevision,
      expectedUpdatedAt: item.expectedUpdatedAt,
      confirmationToken: item.confirmationToken,
      verificationConfig: runtime.verificationConfig,
      readCurrent: async () => {
        lastCurrent = await read()
        return lastCurrent
      },
      readPublishedBefore: runtime.readPublishedBefore,
      saveDraft: async (data) => await payload.update({
        collection: 'products',
        id: item.id,
        data: data as never,
        draft: true,
        depth: 2,
        overrideAccess: false,
        user,
      }) as unknown as PublicDocument,
      readDraft: async () => {
        lastDraft = await read()
        return lastDraft
      },
      assess: (document) => assessProductPublication(document as never),
      publish: async (snapshot) => {
        const publicSnapshot = {
          ...(snapshot as Record<string, unknown>),
          _status: 'published',
        }
        const metadata = createPublicPublicationMetadata('product', publicSnapshot)
        return await payload.update({
          collection: 'products',
          id: item.id,
          data: {
            _status: publicSnapshot._status,
            publicationRevision: metadata.revision,
            publicationContractVersion: metadata.contractVersion,
          } as never,
          draft: false,
          depth: 2,
          overrideAccess: true,
          user,
          context: {
            skipPublicRevisionStamp: true,
            skipPublicationVerification: true,
          },
        }) as unknown as PublicDocument
      },
      extractPublicMetadata: runtime.extractPublicMetadata,
      verify: runtime.verify,
      persistOperationalState: runtime.persistOperationalState,
      attemptRollback: runtime.attemptRollback,
      createReceipt: runtime.createReceipt,
      scheduleRecheck: runtime.scheduleRecheck,
    })

    return mapCoordinatorOutcome({ ok: true, result }, {
      id: item.id,
      title: documentField(lastDraft, 'title') || documentField(lastCurrent, 'title'),
      updatedAt: documentUpdatedAt(lastDraft),
    })
  } catch (error) {
    return mapCoordinatorOutcome({ ok: false, error }, {
      id: item.id,
      title: documentField(lastDraft, 'title') || documentField(lastCurrent, 'title'),
      updatedAt: documentUpdatedAt(lastDraft),
    })
  }
}

export async function publishProductsInBulk(
  payload: Payload,
  user: PayloadRequest['user'],
  items: BulkPublicationItemInput[],
): Promise<BulkPublicationResult> {
  const results: BulkPublicationItemResult[] = []

  for (const item of items) {
    if (typeof item?.expectedUpdatedAt !== 'string' || !item.expectedUpdatedAt.trim()) {
      results.push({
        id: item?.id,
        status: 'failed',
        message: 'Item sem token de concorrência (expectedUpdatedAt). Recarregue a lista e tente novamente.',
      })
      continue
    }

    results.push(await publishSingleProduct(payload, user, item))
  }

  return {
    requested: items.length,
    published: results.filter((result) => result.status === 'published').length,
    unverified: results.filter((result) => result.status === 'published_but_unverified').length,
    incompatible: results.filter((result) => result.status === 'published_but_incompatible').length,
    reverted: results.filter((result) => result.status === 'publish_reverted').length,
    blocked: results.filter((result) => result.status === 'blocked').length,
    conflicts: results.filter((result) => result.status === 'revision_conflict').length,
    failed: results.filter((result) => result.status === 'failed').length,
    results,
  }
}
