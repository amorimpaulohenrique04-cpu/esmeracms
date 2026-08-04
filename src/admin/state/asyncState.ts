// Espelho dos 9 códigos do servidor (src/server/admin/errors/types.ts), mais
// `query_error` e `unknown`, que só existem no cliente e nunca cruzam a rede.
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
  'query_error',
  'unknown',
] as const

export type AdminErrorCode = (typeof adminErrorCodes)[number]
export type AdminIssueSeverity = 'blocker' | 'warning' | 'info'

export type AdminFieldError = {
  path: string
  tab?: string | null
  anchor?: string | null
  code?: string | null
  label?: string | null
  source?: string | null
  message: string
  suggestion?: string | null
  severity?: AdminIssueSeverity
}

export type AdminEntityError = {
  code: string
  message: string
  suggestion?: string | null
  related?: Array<Record<string, unknown>>
}

export type AdminErrorShape = {
  code: AdminErrorCode
  message: string
  summary: string
  status: number | null
  retryable: boolean
  detail?: string | null
  traceId?: string | null
  fieldErrors: AdminFieldError[]
  entityErrors: AdminEntityError[]
  meta?: Record<string, unknown>
}

export type AdminRequestErrorInput = {
  code: AdminErrorCode
  message?: string
  summary?: string
  status?: number | null
  retryable?: boolean
  detail?: string | null
  traceId?: string | null
  fieldErrors?: AdminFieldError[]
  entityErrors?: AdminEntityError[]
  meta?: Record<string, unknown>
}

const statusCodes: Record<number, AdminErrorCode> = {
  400: 'invalid_request',
  401: 'unauthenticated',
  403: 'forbidden',
  404: 'not_found',
  409: 'revision_conflict',
  422: 'validation_error',
  500: 'internal_error',
  503: 'verification_failed',
}

const knownCodes = new Set<string>(adminErrorCodes)

export class AdminRequestError extends Error implements AdminErrorShape {
  code: AdminErrorCode
  summary: string
  status: number | null
  retryable: boolean
  detail?: string | null
  traceId?: string | null
  fieldErrors: AdminFieldError[]
  entityErrors: AdminEntityError[]
  meta?: Record<string, unknown>

  constructor(shape: AdminRequestErrorInput) {
    const summary = shape.summary || shape.message || 'Não foi possível concluir esta operação.'
    super(shape.message || summary)
    this.name = 'AdminRequestError'
    this.code = shape.code
    this.summary = summary
    this.status = shape.status ?? null
    this.retryable = shape.retryable ?? false
    this.detail = shape.detail
    this.traceId = shape.traceId
    this.fieldErrors = shape.fieldErrors || []
    this.entityErrors = shape.entityErrors || []
    this.meta = shape.meta
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function fieldErrors(value: unknown): AdminFieldError[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): AdminFieldError[] => {
    const entry = record(item)
    const path = typeof entry?.path === 'string' ? entry.path : ''
    const message = typeof entry?.message === 'string' ? entry.message : ''
    if (!path || !message) return []
    return [{
      path,
      message,
      tab: typeof entry?.tab === 'string' ? entry.tab : null,
      anchor: typeof entry?.anchor === 'string' ? entry.anchor : null,
      code: typeof entry?.code === 'string' ? entry.code : null,
      suggestion: typeof entry?.suggestion === 'string' ? entry.suggestion : null,
      label: typeof entry?.label === 'string' ? entry.label : null,
      source: typeof entry?.source === 'string' ? entry.source : null,
      severity: entry?.severity === 'warning' || entry?.severity === 'info'
        ? entry.severity
        : 'blocker',
    }]
  })
}

function entityErrors(value: unknown): AdminEntityError[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): AdminEntityError[] => {
    const entry = record(item)
    const code = typeof entry?.code === 'string' ? entry.code : ''
    const message = typeof entry?.message === 'string' ? entry.message : ''
    if (!code || !message) return []
    return [{
      code,
      message,
      suggestion: typeof entry?.suggestion === 'string' ? entry.suggestion : null,
      related: Array.isArray(entry?.related)
        ? entry.related.filter((candidate): candidate is Record<string, unknown> => Boolean(record(candidate)))
        : undefined,
    }]
  })
}

export function adminErrorCodeFromStatus(status: number, bodyCode?: unknown): AdminErrorCode {
  const normalizedBodyCode = String(bodyCode || '').trim()
  if (knownCodes.has(normalizedBodyCode)) return normalizedBodyCode as AdminErrorCode
  return statusCodes[status] || (status >= 500 ? 'query_error' : 'unknown')
}

export function normalizeAdminError(error: unknown, fallback = 'Não foi possível concluir esta operação.'): AdminErrorShape {
  if (error instanceof AdminRequestError) {
    return {
      code: error.code,
      message: error.message,
      summary: error.summary,
      status: error.status,
      retryable: error.retryable,
      detail: error.detail,
      traceId: error.traceId,
      fieldErrors: error.fieldErrors,
      entityErrors: error.entityErrors,
      meta: error.meta,
    }
  }

  if (error instanceof Error) {
    const summary = error.message || fallback
    return {
      code: 'unknown',
      message: summary,
      summary,
      status: null,
      retryable: true,
      fieldErrors: [],
      entityErrors: [],
    }
  }

  return {
    code: 'unknown',
    message: fallback,
    summary: fallback,
    status: null,
    retryable: true,
    fieldErrors: [],
    entityErrors: [],
  }
}

export async function expectAdminResponse<T>(response: Response, fallback: string): Promise<T> {
  const contentType = response.headers.get('content-type') || ''
  let body: unknown

  try {
    body = contentType.includes('application/json') ? await response.json() : await response.text()
  } catch {
    body = null
  }

  const envelope = record(body)
  if (response.ok) {
    if (envelope?.ok === true && record(envelope.result)) return envelope.result as T
    return body as T
  }

  const structuredError = envelope?.ok === false ? record(envelope.error) : null
  const legacyRecord = envelope
  const summary = String(
    structuredError?.summary ||
    legacyRecord?.error ||
    legacyRecord?.message ||
    (typeof body === 'string' ? body : '') ||
    fallback,
  )
  const code = adminErrorCodeFromStatus(response.status, structuredError?.code || legacyRecord?.code)

  throw new AdminRequestError({
    code,
    message: summary,
    summary,
    status: response.status,
    retryable: typeof structuredError?.retryable === 'boolean'
      ? structuredError.retryable
      : response.status >= 500 || response.status === 408 || response.status === 429,
    detail: typeof structuredError?.detail === 'string'
      ? structuredError.detail
      : typeof legacyRecord?.detail === 'string'
      ? legacyRecord.detail
      : null,
    traceId: typeof structuredError?.traceId === 'string'
      ? structuredError.traceId
      : response.headers.get('x-esmera-trace-id'),
    fieldErrors: fieldErrors(structuredError?.fieldErrors),
    entityErrors: entityErrors(structuredError?.entityErrors),
    meta: record(structuredError?.meta) || undefined,
  })
}

export function finiteMetric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function finiteIntegerMetric(value: unknown): number | null {
  const normalized = finiteMetric(value)
  return normalized !== null && Number.isInteger(normalized) ? normalized : null
}

export function assertFiniteMetric(value: unknown, label: string): number {
  const normalized = finiteMetric(value)
  if (normalized === null) {
    throw new AdminRequestError({
      code: 'query_error',
      summary: `${label} não possui um valor numérico válido.`,
      status: null,
      retryable: true,
      fieldErrors: [],
      entityErrors: [],
    })
  }
  return normalized
}
