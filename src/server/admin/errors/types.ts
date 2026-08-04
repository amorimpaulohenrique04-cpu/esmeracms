import type { EditorialFieldLocation } from '../../../issues/registry'
import type { IssueSeverity, PublicationIssue } from '../../../issues/types'

export type { IssueSeverity, PublicationIssue }

export const ADMIN_ERROR_VERSION = '1' as const

/**
 * Códigos de erro administrativo (PR-06, §4.3 do plano do CMS).
 *
 * O plano define sete; `invalid_request` e `unauthenticated` são a extensão mínima
 * aprovada, porque o mesmo §4.3 exige HTTP 400 e 401 e nenhum dos sete os
 * representa. `unauthenticated` (e não `unauthorized`) para não confundir ausência
 * de autenticação com falta de permissão — `forbidden` fica exclusivo do 403.
 *
 * A relação código ↔ status é exclusiva e vive em `httpStatusByCode`
 * (`./serialize`); não existe caminho que produza um status fora dessa tabela.
 */
export const adminErrorCodes = [
  'invalid_request',
  'unauthenticated',
  'forbidden',
  'not_found',
  'revision_conflict',
  'validation_error',
  'publication_blocked',
  'verification_failed',
  'internal_error',
] as const

export type AdminErrorCode = (typeof adminErrorCodes)[number]

export type EntityError = {
  code: string
  message: string
  suggestion?: string | null
  related?: Array<Record<string, unknown>>
}

/**
 * Corpo do erro na rede.
 *
 * As seis primeiras chaves são exatamente o `AdminErrorResponse` do plano. As
 * demais são aditivas e preservam consumidores atuais do admin (`version`,
 * `detail`, `entityErrors`, `meta`), mantidas porque a PR-06 não altera a UI.
 */
export type AdminError = {
  code: AdminErrorCode
  summary: string
  message: string
  fieldErrors: PublicationIssue[]
  traceId: string
  retryable: boolean

  version: typeof ADMIN_ERROR_VERSION
  detail?: string | null
  entityErrors: EntityError[]
  meta?: Record<string, unknown>
}

/** Alias com o nome usado no plano; a forma é a mesma de `AdminError`. */
export type AdminErrorResponse = AdminError

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
  'published_but_incompatible',
  'publish_reverted',
  'requires_confirmation',
  'bulk_completed',
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
  fieldRegistry?: Record<string, EditorialFieldLocation>
  logger?: {
    error: (data: unknown, message?: string) => void
  }
  meta?: Record<string, unknown>
}
