import {
  APIError,
  AuthenticationError,
  Forbidden,
  NotFound,
  UnauthorizedError,
  ValidationError,
} from 'payload'

import { ISSUE_CODES } from '../../../issues/codes'
import { adminErrorCopy, type AdminErrorCopyCatalog } from '../../../issues/copy'
import { defaultEntityTabs, DEFAULT_FALLBACK_TAB, resolveEditorialFieldLocation } from '../../../issues/registry'
import { isEntityScoped, type IssueSeverity, type PublicationIssue } from '../../../issues/types'
import {
  PublicationBlockedError,
  PublicationVerificationFailedError,
  RevisionConflictError,
} from '../../publication/types'
import type { AdminErrorCode, AdminErrorContext, EntityError } from './types'

type UnknownRecord = Record<string, unknown>

/**
 * Relação exclusiva entre código e status HTTP (§4.3 do plano).
 *
 * É a única direção que existe: nenhum caminho do serializer produz um status
 * fora desta tabela, e cada status tem um único código de origem. 403 só vem de
 * `forbidden`; 422 vem de `validation_error` ou `publication_blocked`.
 *
 * ATENÇÃO AO ESCOPO: `ValidationError` do Payload é nativamente 400, e aqui vira
 * 422. Essa tradução vale exclusivamente para as respostas administrativas do
 * Esméra (quem chama `adminErrorResponse`). O error handler nativo do Payload, o
 * admin panel e as rotas legadas continuam com o comportamento original.
 */
export const httpStatusByCode: Record<AdminErrorCode, number> = {
  invalid_request: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  revision_conflict: 409,
  validation_error: 422,
  publication_blocked: 422,
  verification_failed: 503,
  internal_error: 500,
}

const retryableByCode: Record<AdminErrorCode, boolean> = {
  invalid_request: false,
  unauthenticated: false,
  forbidden: false,
  not_found: false,
  revision_conflict: false,
  validation_error: false,
  publication_blocked: false,
  verification_failed: true,
  internal_error: true,
}

export function adminErrorCodeFromStatus(status: number): AdminErrorCode {
  switch (status) {
    case 400: return 'invalid_request'
    case 401: return 'unauthenticated'
    case 403: return 'forbidden'
    case 404: return 'not_found'
    case 409: return 'revision_conflict'
    case 422: return 'validation_error'
    case 503: return 'verification_failed'
    default: return status >= 500 ? 'internal_error' : 'invalid_request'
  }
}

export type NormalizedAdminError = {
  status: number
  code: AdminErrorCode
  summary: string
  message: string
  detail?: string | null
  retryable: boolean
  fieldErrors: PublicationIssue[]
  entityErrors: EntityError[]
  meta?: Record<string, unknown>
}

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' ? value as UnknownRecord : null
}

function safeText(value: unknown, fallback = '', maxLength = 1000): string {
  const text = typeof value === 'string' ? value.trim() : ''
  return (text || fallback).slice(0, maxLength)
}

function normalizePath(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join('.')
  return safeText(value)
}

/**
 * Rótulo declarado pelo próprio Payload. `LabelFunction` precisa de `i18n`, que
 * não temos no momento da serialização, então é ignorada — o registry ou o path
 * assumem. Nunca inventamos um rótulo a partir do texto da mensagem.
 */
function staticLabel(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  const map = record(value)
  if (!map) return ''
  const first = Object.values(map).find((entry) => typeof entry === 'string' && entry.trim())
  return typeof first === 'string' ? first.trim() : ''
}

function severityOf(value: unknown): IssueSeverity {
  return value === 'warning' || value === 'info' ? value : 'blocker'
}

function defaultTab(entity: string | undefined): string {
  return (entity && defaultEntityTabs[entity]) || DEFAULT_FALLBACK_TAB
}

/**
 * Erros de validação aninhados do Payload → `PublicationIssue[]`.
 *
 * O `path` é preservado literalmente (`variants.0.sku`, `gallery.1.alt`); aba,
 * rótulo e âncora saem do registry, que sabe interpolar os índices.
 */
export function issuesFromPayloadValidation(
  rawErrors: readonly unknown[],
  context: AdminErrorContext,
): PublicationIssue[] {
  const mapped = rawErrors.flatMap((raw): PublicationIssue[] => {
    const item = record(raw)
    if (!item) return []
    const path = normalizePath(item.path || item.field || item.name)
    if (!path) return []

    const location = resolveEditorialFieldLocation(context.entity, path, context.fieldRegistry)
    const suggestion = safeText(item.suggestion)
    const anchor = safeText(item.anchor) || location.anchor || ''

    return [{
      code: safeText(item.code) || ISSUE_CODES.payloadFieldInvalid,
      severity: severityOf(item.severity),
      path,
      tab: safeText(item.tab) || location.tab || defaultTab(context.entity),
      label: staticLabel(item.label) || location.label || path,
      message: safeText(item.message, 'Revise este campo.', 500),
      ...(suggestion ? { suggestion } : {}),
      ...(anchor ? { anchor } : {}),
      source: 'payload',
    }]
  })

  // Deduplicação por code|path — nunca pela mensagem, que interpola dados do editor.
  const unique = new Map<string, PublicationIssue>()
  for (const issue of mapped) {
    const key = `${issue.code}|${issue.path}`
    if (!unique.has(key)) unique.set(key, issue)
  }
  return [...unique.values()]
}

function collectRawFieldErrors(error: UnknownRecord | null): unknown[] {
  const candidates = [
    error?.fieldErrors,
    error?.errors,
    record(error?.data)?.errors,
    record(error?.data)?.fieldErrors,
  ]
  return candidates.find(Array.isArray) as unknown[] | undefined || []
}

function mapEntityErrors(error: UnknownRecord | null): EntityError[] {
  const candidates = [error?.entityErrors, record(error?.data)?.entityErrors]
  const raw = candidates.find(Array.isArray) as unknown[] | undefined || []
  return raw.flatMap((value): EntityError[] => {
    const item = record(value)
    if (!item) return []
    const message = safeText(item.message, '', 500)
    if (!message) return []
    return [{
      code: safeText(item.code, 'entity_error', 100),
      message,
      suggestion: safeText(item.suggestion) || null,
      related: Array.isArray(item.related)
        ? item.related.filter((entry): entry is Record<string, unknown> => Boolean(record(entry))) as Array<Record<string, unknown>>
        : undefined,
    }]
  })
}

/**
 * Classificação por `instanceof`, nunca por texto de mensagem ou nome de classe.
 *
 * A ordem importa: `ValidationError`, `Forbidden`, `NotFound`,
 * `AuthenticationError` e `UnauthorizedError` estendem `APIError`, então a
 * verificação da base tem que vir por último.
 */
export function classifyAdminError(thrown: unknown): AdminErrorCode {
  if (thrown instanceof RevisionConflictError) return 'revision_conflict'
  if (thrown instanceof PublicationBlockedError) return 'publication_blocked'
  if (thrown instanceof PublicationVerificationFailedError) return 'verification_failed'
  if (thrown instanceof ValidationError) return 'validation_error'
  if (thrown instanceof Forbidden) return 'forbidden'
  if (thrown instanceof NotFound) return 'not_found'
  if (thrown instanceof AuthenticationError || thrown instanceof UnauthorizedError) return 'unauthenticated'
  if (thrown instanceof APIError) return adminErrorCodeFromStatus(thrown.status)
  return 'internal_error'
}

export function normalizeAdminServerError(
  thrown: unknown,
  context: AdminErrorContext = {},
  copy: AdminErrorCopyCatalog = adminErrorCopy,
): NormalizedAdminError {
  const error = record(thrown)
  const code = classifyAdminError(thrown)
  const status = httpStatusByCode[code]
  const entry = copy[code] || copy.internal_error

  const fieldErrors = code === 'publication_blocked' && Array.isArray(error?.fieldErrors)
    ? error.fieldErrors as PublicationIssue[]
    : issuesFromPayloadValidation(collectRawFieldErrors(error), context)

  const entityErrors = mapEntityErrors(error)

  // `internal_error` é a única classe de erro que não controlamos. Nada dele
  // atravessa para a UI: nem `message`, nem `detail`, nem `meta` — só o traceId,
  // que permite correlacionar com o log completo do servidor.
  const isInternal = code === 'internal_error'

  const explicitRetryable = error?.retryable
  const retryable = typeof explicitRetryable === 'boolean' ? explicitRetryable : retryableByCode[code]

  const summary = isInternal
    ? entry.summary
    : safeText(error?.summary) || safeText(error?.message) || entry.summary

  const message = isInternal
    ? entry.message
    : fieldErrors.length > 0
      ? entry.message
      : safeText(error?.message) || entry.message

  const detail = isInternal ? null : (safeText(error?.detail || record(error?.data)?.detail) || null)
  const meta = isInternal ? undefined : (record(error?.meta) || record(record(error?.data)?.meta) || context.meta || undefined)

  return {
    status,
    code,
    summary: summary.slice(0, 240),
    message: message.slice(0, 500),
    detail,
    retryable,
    fieldErrors,
    entityErrors,
    meta,
  }
}

/** Só para o log do servidor: nunca vai para a resposta. */
export function isEntityScopedIssue(issue: PublicationIssue): boolean {
  return isEntityScoped(issue.path)
}
