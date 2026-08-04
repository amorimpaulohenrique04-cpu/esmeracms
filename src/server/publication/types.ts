import type { FieldError, EntityError, IssueSeverity } from '../admin/errors/types'

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
export type VerifiablePublicationEntity = Extract<PublicationEntity, 'product' | 'category' | 'home'>
export type PublicationIssueSource = 'payload' | 'business_rule' | 'storefront_contract' | 'integration'

export type PublicationIssue = {
  id: string
  severity: IssueSeverity
  path?: string | null
  tab?: string | null
  anchor?: string | null
  message: string
  suggestion?: string | null
  source: PublicationIssueSource
}

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

export class RevisionConflictError extends Error {
  status = 409
  code = 'revision_conflict'
  retryable = false
  entityErrors: EntityError[]

  constructor(message = 'Este conteúdo foi alterado em outra sessão.') {
    super(message)
    this.name = 'RevisionConflictError'
    this.entityErrors = [{
      code: 'revision_conflict',
      message,
      suggestion: 'Recarregue a versão mais recente, revise as diferenças e tente novamente.',
    }]
  }
}

export class PublicationVerificationRequiredError extends Error {
  status = 503
  code = 'verification_required'
  retryable = false
  entityErrors: EntityError[]

  constructor(message = 'A verificação da vitrine precisa estar configurada antes de publicar.') {
    super(message)
    this.name = 'PublicationVerificationRequiredError'
    this.entityErrors = [{
      code: 'verification_required',
      message,
      suggestion: 'Ative a verificação e configure a URL e o token do probe da Deco.',
    }]
  }
}

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

export type PublicationCoordinatorStatus = OperationalPublicationStatus | 'requires_confirmation'

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
  responseReceived?: boolean
}

export type VerificationAttempt = {
  attempt: number
  startedAt: string
  completedAt: string
  durationMs: number
  status: StorefrontVerification['status']
  observedRevision?: string
  issues?: PublicationIssue[]
}

export type PersistedPublicationState = {
  operationalStatus: OperationalPublicationStatus
  verificationStatus: StorefrontVerification['status']
  verifiedAt: string | null
  traceId: string
}

export type PublishedVersionSnapshot<TDocument> = {
  versionId: string | number
  document: TDocument
  publicationRevision: string
  editorialRevision: string
}

export type ConditionalRollbackInput<TDocument> = {
  enabled: boolean
  previous: PublishedVersionSnapshot<TDocument> | null
  currentDocument: TDocument
  currentPublicationRevision: string
  currentEditorialRevision: string
  readCurrent: () => Promise<TDocument>
  restorePrevious: (versionId: string | number) => Promise<TDocument>
  readRestored: () => Promise<TDocument>
  extractPublicRevision: (document: TDocument) => string | null
  createEditorialRevision: (document: TDocument) => string
  verifyRestored?: (document: TDocument, expectedRevision: string) => Promise<StorefrontVerification>
}

export type ConditionalRollbackResult<TDocument = unknown> =
  | {
      status: 'not_needed'
      attempted: false
    }
  | {
      status: 'reverted'
      attempted: true
      restoredRevision: string
      document?: TDocument
      verification?: StorefrontVerification
    }
  | {
      status: 'skipped'
      attempted: false
      reason:
        | 'no_previous_version'
        | 'current_revision_changed'
        | 'current_editorial_revision_changed'
        | 'rollback_disabled'
        | 'previous_version_unavailable'
    }
  | {
      status: 'failed'
      attempted: true
      reason: string
    }

export type PublicationRecheckInput = {
  entity: VerifiablePublicationEntity
  documentId: string | number
  expectedPublicationRevision: string
  contractVersion: string
  parentTraceId: string
  stage: 1 | 2 | 3
}

export type PublicationReceiptOperation = 'publish' | 'recheck' | 'rollback'
export type PublicationReceiptSource =
  | 'individual'
  | 'bulk'
  | 'home-hook'
  | 'scheduled-recheck'
  | 'manual-recheck'

export type PublicationReceipt = {
  traceId: string
  parentTraceId?: string
  operation: PublicationReceiptOperation
  source: PublicationReceiptSource
  entity: VerifiablePublicationEntity
  documentId: string | number
  actorId: string | number
  expectedRevision?: string | null
  savedRevision?: string
  publishedRevision?: string
  previousPublishedRevision?: string
  previousEditorialRevision?: string
  observedRevision?: string
  previousVersionId?: string | number
  status: OperationalPublicationStatus
  verificationStatus?: StorefrontVerification['status']
  contractVersion?: string
  retryable: boolean
  verificationAttempts: VerificationAttempt[]
  rollback?: {
    attempted: boolean
    status: 'not_needed' | 'reverted' | 'skipped' | 'failed'
    reason?: string
    restoredRevision?: string
  }
  issues?: PublicationIssue[]
  startedAt: string
  completedAt: string
  durationMs: number
}

export type BulkPublicationItemStatus =
  | 'published'
  | 'published_but_unverified'
  | 'published_but_incompatible'
  | 'publish_reverted'
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
  publicationRevision?: string
  traceId?: string
  retryable?: boolean
  updatedAt?: string
  issues?: PublicationIssue[]
  confirmationToken?: string
}

export type BulkPublicationResult = {
  requested: number
  published: number
  unverified: number
  incompatible: number
  reverted: number
  blocked: number
  conflicts: number
  failed: number
  results: BulkPublicationItemResult[]
}

export class PublicationBlockedError extends Error {
  status = 422
  code = 'publication_blocked'
  retryable = false
  fieldErrors: FieldError[]
  entityErrors: EntityError[]
  meta: Record<string, unknown>

  constructor(public assessment: PublicationAssessment, draftSaved = true) {
    super('O rascunho foi salvo, mas ainda existem pendências para publicar.')
    this.name = 'PublicationBlockedError'
    this.fieldErrors = assessment.issues
      .filter((issue) => issue.severity === 'blocker' && issue.path)
      .map((issue) => ({
        path: issue.path as string,
        tab: issue.tab || null,
        anchor: issue.anchor || null,
        code: issue.id,
        message: issue.message,
        suggestion: issue.suggestion || null,
        severity: issue.severity,
      }))
    this.entityErrors = assessment.issues
      .filter((issue) => issue.severity === 'blocker' && !issue.path)
      .map((issue) => ({
        code: issue.id,
        message: issue.message,
        suggestion: issue.suggestion || null,
      }))
    this.meta = { assessment, draftSaved }
  }
}
