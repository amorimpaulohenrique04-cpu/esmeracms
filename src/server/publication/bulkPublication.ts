import type { Payload, PayloadRequest } from 'payload'

import { coordinatePublication, type PublicationCoordinatorResult } from './coordinator'
import { assessProductPublication } from './productAssessment'
import { createPublicPublicationMetadata } from './publicRevision'
import { probeStorefrontRevision } from './storefrontProbe'
import {
  PublicationBlockedError,
  RevisionConflictError,
  STOREFRONT_CONTRACT_VERSION,
  type BulkPublicationItemResult,
  type BulkPublicationResult,
  type PublicationIssue,
} from './types'

export const BULK_PUBLICATION_LIMIT = 25

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
      }
    }

    if (result.status === 'publish_reverted') {
      return {
        ...base,
        status: 'failed',
        message: 'A vitrine reportou incompatibilidade e a publicação foi revertida automaticamente.',
        revision: result.revision,
        updatedAt: documentUpdatedAt(result.document) || context.updatedAt,
        issues: issuesOfSeverity(result.assessment?.issues, 'blocker'),
      }
    }

    return {
      ...base,
      status: 'published',
      message: result.status === 'published_but_incompatible'
        ? 'Produto publicado, mas a vitrine reportou incompatibilidade e não foi possível reverter automaticamente.'
        : result.status === 'published_but_unverified'
        ? 'Produto publicado, mas a confirmação visual do site está indisponível.'
        : 'Produto publicado.',
      revision: result.revision,
      updatedAt: documentUpdatedAt(result.document) || context.updatedAt,
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
  let lastCurrent: unknown = null
  let lastDraft: unknown = null

  const read = (req?: PayloadRequest) => payload.findByID({
    collection: 'products',
    id: item.id,
    draft: true,
    depth: 2,
    overrideAccess: false,
    user,
    req,
  })

  try {
    const result = await coordinatePublication({
      entity: 'product',
      entityId: item.id,
      data: { _status: 'draft' },
      expectedRevision: item.expectedRevision,
      expectedUpdatedAt: item.expectedUpdatedAt,
      confirmationToken: item.confirmationToken,
      readCurrent: async () => {
        lastCurrent = await read()
        return lastCurrent
      },
      saveDraft: (data) => payload.update({
        collection: 'products',
        id: item.id,
        data: data as never,
        draft: true,
        depth: 2,
        overrideAccess: false,
        user,
      }),
      readDraft: async () => {
        lastDraft = await read()
        return lastDraft
      },
      assess: (document) => assessProductPublication(document as never),
      publish: (snapshot) => {
        const publicSnapshot = {
          ...(snapshot as Record<string, unknown>),
          _status: 'published',
        }
        const metadata = createPublicPublicationMetadata('product', publicSnapshot)
        return payload.update({
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
        })
      },
      verify: (published, revision) => probeStorefrontRevision({
        entity: 'product',
        entityId: item.id,
        expectedRevision: revision,
        contractVersion: STOREFRONT_CONTRACT_VERSION,
      }),
      revertPublish: () => payload.update({
        collection: 'products',
        id: item.id,
        data: { _status: 'draft' } as never,
        draft: false,
        depth: 2,
        overrideAccess: true,
        user,
      }),
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
    blocked: results.filter((result) => result.status === 'blocked').length,
    conflicts: results.filter((result) => result.status === 'revision_conflict').length,
    failed: results.filter((result) => result.status === 'failed').length,
    results,
  }
}
