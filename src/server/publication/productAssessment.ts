import {
  getProductReadiness,
  type ProductReadinessInput,
} from '../../businessRules/products/readiness'
import { resolveEditorialFieldLocation } from '../admin/errors/registry'
import { validateStorefrontSnapshot } from '../storefront-contract/validate'
import { createDocumentRevision } from './revision'
import {
  PUBLICATION_ASSESSMENT_VERSION,
  STOREFRONT_CONTRACT_VERSION,
  type PublicationAssessment,
  type PublicationIssue,
} from './types'

type ProductDocument = ProductReadinessInput & {
  id?: string | number
  updatedAt?: string | null
}

const issueMap: Array<{
  match: (message: string) => boolean
  id: string
  path: string
  suggestion?: string
}> = [
  { match: (message) => message.startsWith('Título'), id: 'product.title_missing', path: 'title', suggestion: 'Informe um título provisório para continuar.' },
  { match: (message) => message.startsWith('Slug'), id: 'product.slug_missing', path: 'slug', suggestion: 'Revise o endereço gerado para a peça.' },
  { match: (message) => message.startsWith('Código'), id: 'product.code_missing', path: 'code', suggestion: 'Informe um código único para a peça.' },
  { match: (message) => message.includes('Categoria') || message.includes('categoria'), id: 'product.category_invalid', path: 'categories', suggestion: 'Escolha ao menos uma categoria publicada e ativa.' },
  { match: (message) => message.includes('imagem') || message.includes('Galeria') || message.includes('capa'), id: 'product.gallery_invalid', path: 'gallery', suggestion: 'Adicione imagens válidas, texto alternativo e marque exatamente uma capa.' },
  { match: (message) => message.includes('Disponibilidade'), id: 'product.availability_missing', path: 'availability' },
  { match: (message) => message.includes('preço') || message.includes('Preço'), id: 'product.price_invalid', path: 'basePriceCents', suggestion: 'Informe um preço em reais ou altere o produto para sob consulta.' },
  { match: (message) => message.includes('opção') || message.includes('Opção'), id: 'product.options_invalid', path: 'optionDefinitions' },
  { match: (message) => message.includes('variante') || message.includes('SKU') || message.includes('combinação'), id: 'product.variants_invalid', path: 'variants' },
]

function legacyIssue(message: string, index: number): PublicationIssue {
  const mapped = issueMap.find((entry) => entry.match(message))
  const path = mapped?.path || 'publicationIssues'
  const location = resolveEditorialFieldLocation('product', path)
  return {
    id: mapped?.id || `product.legacy_issue_${index + 1}`,
    severity: 'blocker',
    path,
    tab: location.tab || null,
    anchor: location.anchor || null,
    message,
    suggestion: mapped?.suggestion || location.suggestion || null,
    source: 'business_rule',
  }
}

export function assessProductPublication(product: ProductDocument): PublicationAssessment {
  const readiness = getProductReadiness(product)
  const businessIssues = readiness.issues.map(legacyIssue)
  const storefrontValidation = validateStorefrontSnapshot('product', product)
  const issues = [...businessIssues]

  const known = new Set(issues.map((entry) => `${entry.path}|${entry.message}`))
  for (const storefrontIssue of storefrontValidation.issues) {
    const key = `${storefrontIssue.path}|${storefrontIssue.message}`
    if (!known.has(key)) issues.push(storefrontIssue)
  }

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
