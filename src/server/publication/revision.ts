import { createHash } from 'node:crypto'

import { RevisionConflictError } from './types'

const VOLATILE_KEYS = new Set(['createdAt', 'updatedAt', 'publishedAt'])

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (!value || typeof value !== 'object') return value

  const source = value as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(source).sort()) {
    if (VOLATILE_KEYS.has(key)) continue
    const next = source[key]
    if (next === undefined) continue
    result[key] = canonicalValue(next)
  }
  return result
}

export function canonicalizeForRevision(value: unknown): string {
  return JSON.stringify(canonicalValue(value))
}

export function createDocumentRevision(value: unknown): string {
  return createHash('sha256').update(canonicalizeForRevision(value)).digest('hex').slice(0, 32)
}

export function assertExpectedDocumentRevision(
  current: unknown,
  expected: { expectedRevision?: string | null; expectedUpdatedAt?: string | null },
) {
  const currentRecord = current && typeof current === 'object' ? current as Record<string, unknown> : {}
  const currentRevision = createDocumentRevision(current)
  if (expected.expectedRevision && expected.expectedRevision !== currentRevision) {
    throw new RevisionConflictError()
  }

  if (expected.expectedUpdatedAt) {
    const currentUpdatedAt = typeof currentRecord.updatedAt === 'string' ? currentRecord.updatedAt : null
    if (!currentUpdatedAt || currentUpdatedAt !== expected.expectedUpdatedAt) {
      throw new RevisionConflictError()
    }
  }
  return currentRevision
}
