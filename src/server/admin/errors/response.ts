import { NextResponse } from 'next/server'

import { normalizeAdminServerError } from './fromPayload'
import {
  ADMIN_ERROR_VERSION,
  type AdminActionPayload,
  type AdminActionStatus,
  type AdminErrorContext,
  type AdminErrorEnvelope,
  type FieldError,
  type EntityError,
} from './types'

function traceID(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `trace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
  }
}

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

export function adminInputError(
  summary: string,
  input: {
    code?: string
    detail?: string | null
    fieldErrors?: FieldError[]
    entityErrors?: EntityError[]
    retryable?: boolean
    meta?: Record<string, unknown>
  } = {},
  status = 400,
) {
  const envelope: AdminErrorEnvelope = {
    ok: false,
    error: {
      version: ADMIN_ERROR_VERSION,
      code: input.code === 'revision_conflict'
        ? 'revision_conflict'
        : input.code === 'publication_blocked'
        ? 'publication_blocked'
        : status === 422
        ? 'validation_failed'
        : 'invalid_request',
      summary: summary.slice(0, 240),
      detail: input.detail?.slice(0, 1000) || null,
      retryable: input.retryable ?? false,
      traceId: null,
      fieldErrors: input.fieldErrors || [],
      entityErrors: input.entityErrors || [],
      meta: input.meta,
    },
  }
  return NextResponse.json(envelope, { status })
}

export function adminErrorResponse(
  thrown: unknown,
  context: AdminErrorContext = {},
) {
  const traceId = traceID()
  const normalized = normalizeAdminServerError(thrown, context)

  context.logger?.error({
    event: 'admin_action_failed',
    traceId,
    entity: context.entity,
    operation: context.operation,
    code: normalized.code,
    status: normalized.status,
    retryable: normalized.retryable,
    fieldPaths: normalized.fieldErrors.map((issue) => issue.path),
  }, normalized.summary)

  const envelope: AdminErrorEnvelope = {
    ok: false,
    error: {
      version: ADMIN_ERROR_VERSION,
      code: normalized.code,
      summary: normalized.summary,
      detail: normalized.detail || null,
      retryable: normalized.retryable,
      traceId,
      fieldErrors: normalized.fieldErrors,
      entityErrors: normalized.entityErrors,
      meta: normalized.meta,
    },
  }

  return NextResponse.json(envelope, {
    status: Math.max(400, Math.min(599, normalized.status)),
    headers: { 'x-esmera-trace-id': traceId },
  })
}
