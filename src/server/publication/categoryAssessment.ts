import { decorateIssues, mergeIssues } from '../../issues/build'
import { ISSUE_CODES } from '../../issues/codes'
import type { RawIssue } from '../../issues/types'
import { validateStorefrontSnapshot } from '../storefront-contract/validate'
import { createDocumentRevision } from './revision'
import {
  PUBLICATION_ASSESSMENT_VERSION,
  STOREFRONT_CONTRACT_VERSION,
  type PublicationAssessment,
} from './types'

type CategoryDocument = {
  id?: string | number
  title?: string | null
  slug?: string | null
  status?: string | null
  parent?: unknown
  image?: unknown
  _status?: string | null
  updatedAt?: string | null
  [key: string]: unknown
}

function relationID(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' || typeof id === 'number' ? id : null
  }
  return null
}

/** Decisão pura de readiness da categoria: nenhuma copy atravessa esta função. */
export function collectCategoryReadinessIssues(category: CategoryDocument): RawIssue[] {
  const raws: RawIssue[] = []
  const entityId = category.id ?? 'new'

  if (!category.title?.trim()) {
    raws.push({ code: ISSUE_CODES.categoryTitleMissing, severity: 'blocker', path: 'title', source: 'readiness' })
  }
  if (!category.slug?.trim()) {
    raws.push({ code: ISSUE_CODES.categorySlugMissing, severity: 'blocker', path: 'slug', source: 'readiness' })
  }

  const parentID = relationID(category.parent)
  if (parentID !== null && String(parentID) === String(entityId)) {
    raws.push({ code: ISSUE_CODES.categoryParentSelfReference, severity: 'blocker', path: 'parent', source: 'readiness' })
  }

  return raws
}

export function assessCategoryPublication(category: CategoryDocument): PublicationAssessment {
  const entityId = category.id ?? 'new'
  const readinessIssues = decorateIssues(collectCategoryReadinessIssues(category), 'category')
  const storefrontValidation = validateStorefrontSnapshot('category', category)
  const issues = mergeIssues(readinessIssues, storefrontValidation.issues)

  return {
    version: PUBLICATION_ASSESSMENT_VERSION,
    entity: 'category',
    entityId,
    revision: createDocumentRevision(category),
    ready: issues.every((entry) => entry.severity !== 'blocker'),
    issues,
    storefront: {
      contractVersion: STOREFRONT_CONTRACT_VERSION,
      compatible: storefrontValidation.compatible,
      issues: storefrontValidation.issues,
      probeStatus: 'not_run',
    },
    assessedAt: new Date().toISOString(),
  }
}
