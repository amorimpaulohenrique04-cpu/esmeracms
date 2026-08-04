import { decorateIssue } from '../../issues/build'
import { ISSUE_CODES } from '../../issues/codes'
import { issueCopy } from '../../issues/copy'
import { ENTITY_PATH_REVISION, isEntityScoped, type IssueSeverity, type IssueSource, type PublicationIssue } from '../../issues/types'
import type { EntityError } from '../admin/errors/types'

export type { IssueSeverity, PublicationIssue }

/** @deprecated Use `IssueSource` de `src/issues/types`. Mantido só como alias de leitura. */
export type PublicationIssueSource = IssueSource

export const PUBLICATION_ASSESSMENT_VERSION = '1' as const
export const STOREFRONT_CONTRACT_VERSION = '1' as const

export const publicationEntities = [
  'product',
  'category',
  'home',
  'navigation',
  'site-settings',
  'about',
  'contact',
  'collection-page',
] as const

export type PublicationEntity = (typeof publicationEntities)[number]

export type StorefrontCompatibilityAssessment = {
  contractVersion: typeof STOREFRONT_CONTRACT_VERSION
  compatible: boolean
  issues: PublicationIssue[]
  probeStatus: 'not_run' | 'compatible' | 'incompatible' | 'unavailable'
}

export type PublicationAssessment = {
  version: typeof PUBLICATION_ASSESSMENT_VERSION
  entity: PublicationEntity
  entityId: string | number
  revision: string
  ready: boolean
  issues: PublicationIssue[]
  storefront: StorefrontCompatibilityAssessment
  assessedAt: string
}

const revisionConflictCopy = issueCopy[ISSUE_CODES.revisionConflict]

export class RevisionConflictError extends Error {
  status = 409
  code = 'revision_conflict' as const
  retryable = false
  issues: PublicationIssue[]
  entityErrors: EntityError[]

  constructor(message = revisionConflictCopy.message({})) {
    super(message)
    this.name = 'RevisionConflictError'
    // A entidade não é conhecida aqui: o conflito é detectado antes de sabermos
    // qual coleção está sendo gravada. O path `$revision` resolve pelo registry
    // compartilhado, e a mensagem recebida vence a do catálogo para preservar as
    // chamadas que passam uma copy própria.
    this.issues = [{
      ...decorateIssue({
        code: ISSUE_CODES.revisionConflict,
        severity: 'blocker',
        path: ENTITY_PATH_REVISION,
        source: 'concurrency',
      }, undefined),
      message,
    }]
    this.entityErrors = [{
      code: ISSUE_CODES.revisionConflict,
      message,
      suggestion: revisionConflictCopy.suggestion ?? null,
    }]
  }
}

/**
 * Integração obrigatória de verificação indisponível → HTTP 503.
 *
 * Não há produtor em `main`: quem vai lançá-la é o probe do storefront da PR-05.
 * Declarada aqui para que o serializer já tenha o ramo de classificação fechado
 * e testado — sem isso, o 503 exigido pelo §4.3 não teria como ser produzido.
 */
export class PublicationVerificationFailedError extends Error {
  status = 503
  code = 'verification_failed' as const
  retryable = true

  constructor(message = 'Não foi possível confirmar a publicação no site.') {
    super(message)
    this.name = 'PublicationVerificationFailedError'
  }
}

// Forward-declared for the coordinator/bulk/verify work in later phases (see docs/cms-implementation-plan.md).
// Not yet consumed by production code — kept here so tests can assert against the agreed shape early.
export type OperationalPublicationStatus =
  | 'draft'
  | 'ready'
  | 'publishing'
  | 'pending_verification'
  | 'published'
  | 'published_but_unverified'
  | 'published_but_incompatible'
  | 'publish_reverted'
  | 'blocked'
  | 'conflict'
  | 'failed'

export type StorefrontVerification = {
  status: 'compatible' | 'incompatible' | 'revision_mismatch' | 'unavailable' | 'not_run'
  expectedRevision: string
  observedRevision?: string
  contractVersion: string
  checkedAt: string
  publicUrl?: string
  issues?: Array<{
    code: string
    path?: string
    message: string
  }>
  retryAfterMs?: number
}

export type PublicationReceipt = {
  traceId: string
  entity: PublicationEntity
  documentId: string | number
  actorId: string | number
  expectedRevision?: string | null
  savedRevision?: string
  publishedRevision?: string
  previousPublishedRevision?: string
  status: OperationalPublicationStatus
  verificationStatus?: StorefrontVerification['status']
  contractVersion?: string
  startedAt: string
  completedAt: string
  durationMs: number
  issues?: PublicationIssue[]
}

// Vocabulário próprio do lote: não reusa OperationalPublicationStatus, que tem
// `conflict` (não `revision_conflict`) e não tem `warning_requires_confirmation`.
export type BulkPublicationItemStatus =
  | 'published'
  | 'blocked'
  | 'warning_requires_confirmation'
  | 'revision_conflict'
  | 'failed'

export type BulkPublicationItemResult = {
  id: string | number
  title?: string
  status: BulkPublicationItemStatus
  message: string
  revision?: string
  // Token temporal devolvido pelo servidor. Obrigatório no handshake de
  // confirmação de warnings: coordinatePublication() valida expectedUpdatedAt
  // ANTES de saveDraft(), então o updatedAt original da lista já está vencido
  // quando `requires_confirmation` retorna. Ver docs/cms-implementation-plan.md.
  updatedAt?: string
  issues?: PublicationIssue[]
  confirmationToken?: string
}

export type BulkPublicationResult = {
  requested: number
  published: number
  blocked: number
  conflicts: number
  failed: number
  results: BulkPublicationItemResult[]
}

export class PublicationBlockedError extends Error {
  status = 422
  code = 'publication_blocked' as const
  retryable = false
  fieldErrors: PublicationIssue[]
  entityErrors: EntityError[]
  meta: Record<string, unknown>

  constructor(public assessment: PublicationAssessment, draftSaved = true) {
    super('O rascunho foi salvo, mas ainda existem pendências para publicar.')
    this.name = 'PublicationBlockedError'
    const blockers = assessment.issues.filter((issue) => issue.severity === 'blocker')
    // `path` agora é sempre preenchido, então a divisão passa a ser pelo escopo:
    // paths sentinela (`$document`, `$revision`) valem para o documento inteiro.
    this.fieldErrors = blockers.filter((issue) => !isEntityScoped(issue.path))
    this.entityErrors = blockers
      .filter((issue) => isEntityScoped(issue.path))
      .map((issue) => ({
        code: issue.code,
        message: issue.message,
        suggestion: issue.suggestion ?? null,
      }))
    this.meta = { assessment, draftSaved }
  }
}
