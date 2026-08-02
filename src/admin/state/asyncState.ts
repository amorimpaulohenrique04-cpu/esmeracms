export const adminErrorCodes = [
  'query_error',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'duplicate',
  'mutation_rollback',
  'job_failed',
  'integration_unconfigured',
  'unknown',
] as const

export type AdminErrorCode = (typeof adminErrorCodes)[number]

export type AdminErrorShape = {
  code: AdminErrorCode
  message: string
  status: number | null
  retryable: boolean
  detail?: string | null
}

const statusCodes: Record<number, AdminErrorCode> = {
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
}

const knownCodes = new Set<string>(adminErrorCodes)

export class AdminRequestError extends Error implements AdminErrorShape {
  code: AdminErrorCode
  status: number | null
  retryable: boolean
  detail?: string | null

  constructor(shape: AdminErrorShape) {
    super(shape.message)
    this.name = 'AdminRequestError'
    this.code = shape.code
    this.status = shape.status
    this.retryable = shape.retryable
    this.detail = shape.detail
  }
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
      status: error.status,
      retryable: error.retryable,
      detail: error.detail,
    }
  }

  if (error instanceof Error) {
    return {
      code: 'unknown',
      message: error.message || fallback,
      status: null,
      retryable: true,
    }
  }

  return {
    code: 'unknown',
    message: fallback,
    status: null,
    retryable: true,
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

  if (response.ok) return body as T

  const record = body && typeof body === 'object' ? body as Record<string, unknown> : null
  const message = String(record?.error || record?.message || (typeof body === 'string' ? body : '') || fallback)
  const code = adminErrorCodeFromStatus(response.status, record?.code)

  throw new AdminRequestError({
    code,
    message,
    status: response.status,
    retryable: response.status >= 500 || response.status === 408 || response.status === 429 || code === 'job_failed' || code === 'mutation_rollback',
    detail: typeof record?.detail === 'string' ? record.detail : null,
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
      message: `${label} não possui um valor numérico válido.`,
      status: null,
      retryable: true,
    })
  }
  return normalized
}
