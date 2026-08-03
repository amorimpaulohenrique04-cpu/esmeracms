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
