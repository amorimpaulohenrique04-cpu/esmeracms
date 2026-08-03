import { validateStorefrontSnapshot } from '../storefront-contract/validate'
import { createDocumentRevision } from './revision'
import {
  PUBLICATION_ASSESSMENT_VERSION,
  STOREFRONT_CONTRACT_VERSION,
  type PublicationAssessment,
  type PublicationIssue,
} from './types'

type HomeDocument = {
  id?: string | number
  disabledSections?: string[] | null
  heroMode?: string | null
  heroSlides?: unknown[] | null
  matterPanels?: unknown[] | null
  signatureSlides?: unknown[] | null
  provenanceSteps?: unknown[] | null
  [key: string]: unknown
}

export function assessHomePublication(home: HomeDocument): PublicationAssessment {
  const issues: PublicationIssue[] = []
  const disabled = new Set(home.disabledSections || [])
  const heroSlides = Array.isArray(home.heroSlides) ? home.heroSlides : []
  const activeHeroSlides = heroSlides.filter((value) =>
    !value || typeof value !== 'object' || (value as { active?: boolean }).active !== false
  )

  if (!disabled.has('hero') && heroSlides.length > 0) {
    if (home.heroMode === 'single' && activeHeroSlides.length !== 1) {
      issues.push({
        id: 'home.hero.single_count',
        severity: 'blocker',
        path: 'heroSlides',
        tab: 'hero',
        anchor: 'home-hero',
        message: 'No modo de imagem única, deixe exatamente um slide ativo.',
        suggestion: 'Desative os slides excedentes ou altere o modo para carrossel.',
        source: 'business_rule',
      })
    }
    if (home.heroMode === 'carousel' && (activeHeroSlides.length < 2 || activeHeroSlides.length > 5)) {
      issues.push({
        id: 'home.hero.carousel_count',
        severity: 'blocker',
        path: 'heroSlides',
        tab: 'hero',
        anchor: 'home-hero',
        message: 'O carrossel precisa ter entre dois e cinco slides ativos.',
        suggestion: 'Revise quais slides estão ativos antes de publicar.',
        source: 'business_rule',
      })
    }
  }

  const storefrontValidation = validateStorefrontSnapshot('home', home)
  const known = new Set(issues.map((entry) => `${entry.path}|${entry.message}`))
  for (const storefrontIssue of storefrontValidation.issues) {
    const key = `${storefrontIssue.path}|${storefrontIssue.message}`
    if (!known.has(key)) issues.push(storefrontIssue)
  }

  return {
    version: PUBLICATION_ASSESSMENT_VERSION,
    entity: 'home',
    entityId: home.id ?? 'home',
    revision: createDocumentRevision(home),
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
