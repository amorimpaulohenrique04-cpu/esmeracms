import {
  collectProductReadinessIssues,
  type ProductReadinessInput,
} from '../../businessRules/products/readiness'
import { decorateIssues, mergeIssues } from '../../issues/build'
import { validateStorefrontSnapshot } from '../storefront-contract/validate'
import { createDocumentRevision } from './revision'
import {
  PUBLICATION_ASSESSMENT_VERSION,
  STOREFRONT_CONTRACT_VERSION,
  type PublicationAssessment,
} from './types'

type ProductDocument = ProductReadinessInput & {
  id?: string | number
  updatedAt?: string | null
}

/**
 * O readiness já entrega issues estruturadas: código, path, aba, rótulo e âncora
 * vêm da própria decisão e do registry. Não há mais nenhum mapeamento por texto
 * de mensagem — o antigo `issueMap` (`startsWith('Título')`, `includes('SKU')`…)
 * e o `legacyIssue` com id posicional foram removidos na PR-06.
 */
export function assessProductPublication(product: ProductDocument): PublicationAssessment {
  const readinessIssues = decorateIssues(collectProductReadinessIssues(product), 'product')
  const storefrontValidation = validateStorefrontSnapshot('product', product)
  const issues = mergeIssues(readinessIssues, storefrontValidation.issues)

  const entityId = product.id ?? 'new'
  const revision = createDocumentRevision(product)
  const ready = issues.every((entry) => entry.severity !== 'blocker')

  return {
    version: PUBLICATION_ASSESSMENT_VERSION,
    entity: 'product',
    entityId,
    revision,
    ready,
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
