import { NextResponse } from 'next/server'

import type { PublicationIssue } from '../../../issues/types'
import { adminErrorCopy } from '../../../issues/copy'
import { httpStatusByCode, normalizeAdminServerError } from './serialize'
import {
  ADMIN_ERROR_VERSION,
  type AdminActionPayload,
  type AdminActionStatus,
  type AdminErrorCode,
  type AdminErrorContext,
  type AdminErrorEnvelope,
  type EntityError,
} from './types'

export function newTraceId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `trace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
  }
}

const traceID = newTraceId

export function adminActionResponse<TMeta extends Record<string, unknown> = Record<string, unknown>>(
  status: AdminActionStatus,
  input: Omit<AdminActionPayload<TMeta>, 'version' | 'status'> = {},
  httpStatus = 200,
) {
  return NextResponse.json({
    ok: true,
    result: {
      version: ADMIN_ERROR_VERSION,
      status,
      ...input,
    },
  }, { status: httpStatus })
}

type AdminErrorInput = {
  summary?: string
  message?: string
  detail?: string | null
  fieldErrors?: PublicationIssue[]
  entityErrors?: EntityError[]
  retryable?: boolean
  meta?: Record<string, unknown>
}

/**
 * Erro administrativo com código explícito. O status vem da tabela exclusiva —
 * não é parâmetro, para não existir caminho que produza um par código/status
 * incoerente.
 */
export function adminCodedError(code: AdminErrorCode, input: AdminErrorInput = {}) {
  const traceId = traceID()
  const copy = adminErrorCopy[code] || adminErrorCopy.internal_error

  const envelope: AdminErrorEnvelope = {
    ok: false,
    error: {
      code,
      summary: (input.summary || copy.summary).slice(0, 240),
      message: (input.message || copy.message).slice(0, 500),
      fieldErrors: input.fieldErrors || [],
      traceId,
      retryable: input.retryable ?? false,

      version: ADMIN_ERROR_VERSION,
      detail: input.detail?.slice(0, 1000) || null,
      entityErrors: input.entityErrors || [],
      meta: input.meta,
    },
  }

  return NextResponse.json(envelope, {
    status: httpStatusByCode[code],
    headers: { 'x-esmera-trace-id': traceId },
  })
}

/** Atalho para requisição malformada — o caso mais comum de `adminCodedError`. */
export function adminInputError(summary: string, input: AdminErrorInput = {}) {
  return adminCodedError('invalid_request', { ...input, summary })
}

export function adminErrorResponse(
  thrown: unknown,
  context: AdminErrorContext = {},
) {
  const traceId = traceID()
  const normalized = normalizeAdminServerError(thrown, context)

  // O erro completo, com stack, fica só no log do servidor, correlacionado pelo
  // traceId. A resposta nunca carrega stack, SQL nem mensagem de driver.
  context.logger?.error({
    event: 'admin_action_failed',
    traceId,
    entity: context.entity,
    operation: context.operation,
    code: normalized.code,
    status: normalized.status,
    retryable: normalized.retryable,
    fieldPaths: normalized.fieldErrors.map((issue) => issue.path),
    err: thrown,
  }, normalized.summary)

  const envelope: AdminErrorEnvelope = {
    ok: false,
    error: {
      code: normalized.code,
      summary: normalized.summary,
      message: normalized.message,
      fieldErrors: normalized.fieldErrors,
      traceId,
      retryable: normalized.retryable,

      version: ADMIN_ERROR_VERSION,
      detail: normalized.detail || null,
      entityErrors: normalized.entityErrors,
      meta: normalized.meta,
    },
  }

  return NextResponse.json(envelope, {
    status: normalized.status,
    headers: { 'x-esmera-trace-id': traceId },
  })
}
