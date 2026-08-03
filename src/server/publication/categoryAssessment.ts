import { validateStorefrontSnapshot } from '../storefront-contract/validate'
import { createDocumentRevision } from './revision'
import {
  PUBLICATION_ASSESSMENT_VERSION,
  STOREFRONT_CONTRACT_VERSION,
  type PublicationAssessment,
  type PublicationIssue,
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

export function assessCategoryPublication(category: CategoryDocument): PublicationAssessment {
  const issues: PublicationIssue[] = []
  const entityId = category.id ?? 'new'

  if (!category.title?.trim()) {
    issues.push({
      id: 'category.title_missing',
      severity: 'blocker',
      path: 'title',
      tab: 'content',
      anchor: 'category-title',
      message: 'A categoria precisa de um nome.',
      suggestion: 'Informe o nome que será exibido no catálogo.',
      source: 'business_rule',
    })
  }
  if (!category.slug?.trim()) {
    issues.push({
      id: 'category.slug_missing',
      severity: 'blocker',
      path: 'slug',
      tab: 'content',
      anchor: 'category-slug',
      message: 'A categoria precisa de um endereço válido.',
      suggestion: 'Revise o endereço gerado automaticamente.',
      source: 'business_rule',
    })
  }
  const parentID = relationID(category.parent)
  if (parentID !== null && String(parentID) === String(entityId)) {
    issues.push({
      id: 'category.parent_cycle',
      severity: 'blocker',
      path: 'parent',
      tab: 'content',
      anchor: 'category-parent',
      message: 'A categoria não pode ser principal de si mesma.',
      suggestion: 'Escolha outra categoria principal ou deixe o campo vazio.',
      source: 'business_rule',
    })
  }

  const storefrontValidation = validateStorefrontSnapshot('category', category)
  const known = new Set(issues.map((entry) => `${entry.path}|${entry.message}`))
  for (const storefrontIssue of storefrontValidation.issues) {
    const key = `${storefrontIssue.path}|${storefrontIssue.message}`
    if (!known.has(key)) issues.push(storefrontIssue)
  }

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
