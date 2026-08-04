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

export type BulkPublicationResult = {
  requested: number
  published: number
  unverified: number
  incompatible: number
  reverted: number
  blocked: number
  conflicted: number
  failed: number
  results: Array<{
    id: string | number
    title?: string
    expectedRevision?: string
    publishedRevision?: string
    status: OperationalPublicationStatus
    message: string
    fieldErrors?: PublicationIssue[]
    verification?: StorefrontVerification
    retryable: boolean
  }>
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
