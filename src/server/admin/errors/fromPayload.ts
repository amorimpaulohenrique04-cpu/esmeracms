import { resolveEditorialFieldLocation } from './registry'
import type {
  AdminErrorCode,
  AdminErrorContext,
  EntityError,
  FieldError,
} from './types'

type UnknownRecord = Record<string, unknown>

export type NormalizedAdminError = {
  status: number
  code: AdminErrorCode
  summary: string
  detail?: string | null
  retryable: boolean
  fieldErrors: FieldError[]
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

function numericStatus(error: UnknownRecord | null): number | null {
  for (const value of [error?.status, error?.statusCode, record(error?.data)?.status]) {
    if (typeof value === 'number' && Number.isInteger(value)) return value
  }
  return null
}

function inferCode(error: UnknownRecord | null, status: number, message: string): AdminErrorCode {
  const explicitCode = safeText(error?.code).toLowerCase()
  const normalizedName = safeText(error?.name).toLowerCase()
  const normalizedMessage = message.toLowerCase()

  if (explicitCode === 'revision_conflict' || normalizedName.includes('revisionconflict')) return 'revision_conflict'
  if (explicitCode === 'publication_blocked' || normalizedName.includes('publicationblocked')) return 'publication_blocked'
  if (explicitCode === 'duplicate' || normalizedMessage.includes('unique') || normalizedMessage.includes('duplic')) return 'duplicate'
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 409) return 'revision_conflict'
  if (status === 422 || normalizedName.includes('validation')) return 'validation_failed'
  if (status === 400) return 'invalid_request'
  if (status === 503) return 'integration_unavailable'
  if (status >= 500) return 'query_error'
  return 'unknown'
}

function collectRawErrors(error: UnknownRecord | null): unknown[] {
  const candidates = [
    error?.fieldErrors,
    error?.errors,
    record(error?.data)?.errors,
    record(error?.data)?.fieldErrors,
  ]
  return candidates.find(Array.isArray) as unknown[] | undefined || []
}

function normalizePath(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join('.')
  return safeText(value)
}

function mapFieldErrors(
  error: UnknownRecord | null,
  context: AdminErrorContext,
): FieldError[] {
  const rawErrors = collectRawErrors(error)
  const mapped = rawErrors.flatMap((raw): FieldError[] => {
    const item = record(raw)
    if (!item) return []
    const path = normalizePath(item.path || item.field || item.name)
    if (!path) return []
    const location = resolveEditorialFieldLocation(context.entity, path, context.fieldRegistry)
    const message = safeText(item.message, 'Revise este campo.', 500)
    return [{
      path,
      tab: safeText(item.tab) || location.tab || null,
      anchor: safeText(item.anchor) || location.anchor || null,
      code: safeText(item.code) || null,
      message,
      suggestion: safeText(item.suggestion) || location.suggestion || null,
      severity: item.severity === 'warning' || item.severity === 'recommendation'
        ? item.severity
        : 'blocker',
    }]
  })

  const unique = new Map<string, FieldError>()
  for (const issue of mapped) unique.set(`${issue.path}|${issue.message}`, issue)
  return [...unique.values()]
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

export function normalizeAdminServerError(
  thrown: unknown,
  context: AdminErrorContext = {},
): NormalizedAdminError {
  const error = record(thrown)
  const message = safeText(error?.message, 'Não foi possível concluir esta operação.', 500)
  const status = numericStatus(error) || 500
  const fieldErrors = mapFieldErrors(error, context)
  const entityErrors = mapEntityErrors(error)
  const code = inferCode(error, status, message)

  const summary = code === 'revision_conflict'
    ? 'Este conteúdo foi alterado em outra sessão. Revise a versão mais recente antes de publicar.'
    : code === 'publication_blocked'
    ? 'O rascunho foi salvo, mas ainda existem pendências para publicar.'
    : fieldErrors.length > 0
    ? `Revise ${fieldErrors.length === 1 ? 'o campo indicado' : `${fieldErrors.length} campos indicados`} antes de continuar.`
    : message

  const explicitRetryable = error?.retryable
  const retryable = typeof explicitRetryable === 'boolean'
    ? explicitRetryable
    : status === 408 || status === 429 || status >= 500

  const detail = safeText(error?.detail || record(error?.data)?.detail) || null
  const meta = record(error?.meta) || record(record(error?.data)?.meta) || context.meta

  return {
    status,
    code,
    summary: summary.slice(0, 240),
    detail,
    retryable,
    fieldErrors,
    entityErrors,
    meta: meta || undefined,
  }
}
