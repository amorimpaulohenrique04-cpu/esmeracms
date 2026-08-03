export const ADMIN_ERROR_VERSION = '1' as const

export const adminErrorCodes = [
  'invalid_request',
  'validation_failed',
  'publication_blocked',
  'revision_conflict',
  'unauthorized',
  'forbidden',
  'not_found',
  'duplicate',
  'mutation_rollback',
  'job_failed',
  'integration_unconfigured',
  'integration_unavailable',
  'query_error',
  'unknown',
] as const

export type AdminErrorCode = (typeof adminErrorCodes)[number]
export type IssueSeverity = 'blocker' | 'warning' | 'recommendation'

export type FieldError = {
  path: string
  tab?: string | null
  anchor?: string | null
  code?: string | null
  message: string
  suggestion?: string | null
  severity?: IssueSeverity
}

export type EntityError = {
  code: string
  message: string
  suggestion?: string | null
  related?: Array<Record<string, unknown>>
}

export type AdminError = {
  version: typeof ADMIN_ERROR_VERSION
  code: AdminErrorCode
  summary: string
  detail?: string | null
  retryable: boolean
  traceId?: string | null
  fieldErrors: FieldError[]
  entityErrors: EntityError[]
  meta?: Record<string, unknown>
}

export type AdminErrorEnvelope = {
  ok: false
  error: AdminError
}

export const adminActionStatuses = [
  'saved',
  'published',
  'unpublished',
  'archived',
  'restored',
  'published_but_unverified',
  'requires_confirmation',
] as const

export type AdminActionStatus = (typeof adminActionStatuses)[number]

export type AdminActionPayload<TMeta extends Record<string, unknown> = Record<string, unknown>> = {
  version: typeof ADMIN_ERROR_VERSION
  status: AdminActionStatus
  entityId?: string | number
  revision?: string | null
  assessment?: Record<string, unknown> | null
  message?: string
  meta?: TMeta
}

export type AdminActionSuccess<TMeta extends Record<string, unknown> = Record<string, unknown>> = {
  ok: true
  result: AdminActionPayload<TMeta>
}

export type AdminActionResult<TMeta extends Record<string, unknown> = Record<string, unknown>> =
  | AdminActionSuccess<TMeta>
  | AdminErrorEnvelope

export type AdminErrorContext = {
  entity?: string
  operation?: string
  fieldRegistry?: Record<string, { tab?: string; anchor?: string; suggestion?: string }>
  logger?: {
    error: (data: unknown, message?: string) => void
  }
  meta?: Record<string, unknown>
}
