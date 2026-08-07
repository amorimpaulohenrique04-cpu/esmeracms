import { createHash } from 'node:crypto'

import { STOREFRONT_CONTRACT_VERSION } from './types'

export type PublicRevisionEntity = 'product' | 'category' | 'home'

type PublicRecord = Record<string, unknown>

export class PublicRevisionProjectionError extends Error {
  constructor(message: string, public readonly path?: string) {
    super(path ? `${message} (${path})` : message)
    this.name = 'PublicRevisionProjectionError'
  }
}

function record(value: unknown): PublicRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as PublicRecord
    : null
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue)
  const source = record(value)
  if (!source) return value

  const result: PublicRecord = {}
  for (const key of Object.keys(source).sort()) {
    const next = source[key]
    if (next === undefined) continue
    result[key] = canonicalValue(next)
  }
  return result
}

function scalar(value: unknown): unknown {
  return value
}

function relationID(value: unknown, path: string): string | number | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value === 'string' || typeof value === 'number') return value
  const relation = record(value)
  if (relation && (typeof relation.id === 'string' || typeof relation.id === 'number')) {
    return relation.id
  }
  throw new PublicRevisionProjectionError('A relação não possui uma identidade pública válida.', path)
}

function populatedRelation(value: unknown, path: string): PublicRecord | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value === 'string' || typeof value === 'number') {
    throw new PublicRevisionProjectionError('A relação precisa estar populada para calcular a revisão pública.', path)
  }
  const relation = record(value)
  if (!relation) {
    throw new PublicRevisionProjectionError('A relação pública possui formato inválido.', path)
  }
  return relation
}

function projectMedia(value: unknown, path: string, explicitAlt?: unknown): unknown {
  const media = populatedRelation(value, path)
  if (media === undefined || media === null) return media
  return {
    url: typeof media.url === 'string' || media.url === null ? media.url : null,
    alt: typeof explicitAlt === 'string' || explicitAlt === null
      ? explicitAlt
      : typeof media.alt === 'string' || media.alt === null
      ? media.alt
      : null,
  }
}

function projectImageField(value: unknown, path: string): unknown {
  if (value === undefined || value === null) return value
  if (typeof value === 'string' || typeof value === 'number') {
    return projectMedia(value, path)
  }
  const group = record(value)
  if (!group) throw new PublicRevisionProjectionError('O campo de imagem possui formato inválido.', path)
  if ('image' in group) return projectMedia(group.image, `${path}.image`, group.alt)
  return projectMedia(group, path)
}

function projectCTA(value: unknown): unknown {
  if (value === undefined || value === null) return value
  const cta = record(value)
  if (!cta) return null
  return {
    label: scalar(cta.label),
    href: scalar(cta.href),
    kind: scalar(cta.kind),
    destinationType: scalar(cta.destinationType),
    path: scalar(cta.path),
    url: scalar(cta.url),
  }
}

function projectSEO(value: unknown, path: string): unknown {
  if (value === undefined || value === null) return value
  const seo = record(value)
  if (!seo) return null
  return {
    title: scalar(seo.title),
    description: scalar(seo.description),
    canonical: scalar(seo.canonical),
    noIndex: scalar(seo.noIndex),
    noindex: scalar(seo.noindex),
    socialImage: projectMedia(seo.socialImage, `${path}.socialImage`),
  }
}

function projectCategorySummary(value: unknown, path: string): unknown {
  const category = populatedRelation(value, path)
  if (category === undefined || category === null) return category
  return {
    id: scalar(category.id),
    title: scalar(category.title),
    slug: scalar(category.slug),
    status: scalar(category.status),
    _status: scalar(category._status),
  }
}

function projectProduct(document: PublicRecord, path = 'product'): unknown {
  const categories = Array.isArray(document.categories)
    ? document.categories.map((category, index) => projectCategorySummary(category, `${path}.categories.${index}`))
    : document.categories

  const gallery = Array.isArray(document.gallery)
    ? document.gallery.map((value, index) => {
      const item = record(value) || {}
      return {
        role: scalar(item.role),
        mediaKey: scalar(item.mediaKey),
        alt: scalar(item.alt),
        image: projectMedia(item.image, `${path}.gallery.${index}.image`),
      }
    })
    : document.gallery

  const attributes = Array.isArray(document.attributes)
    ? document.attributes.map((value) => {
      const item = record(value) || {}
      return { label: scalar(item.label), value: scalar(item.value) }
    })
    : document.attributes

  const searchTerms = Array.isArray(document.searchTerms)
    ? document.searchTerms.map((value) => {
      const item = record(value) || {}
      return { term: scalar(item.term) }
    })
    : document.searchTerms

  const optionDefinitions = Array.isArray(document.optionDefinitions)
    ? document.optionDefinitions.map((value) => {
      const definition = record(value) || {}
      return {
        code: scalar(definition.code),
        label: scalar(definition.label),
        values: Array.isArray(definition.values)
          ? definition.values.map((entry) => {
            const option = record(entry) || {}
            return {
              value: scalar(option.value),
              label: scalar(option.label),
              swatch: scalar(option.swatch),
            }
          })
          : definition.values,
      }
    })
    : document.optionDefinitions

  const variants = Array.isArray(document.variants)
    ? document.variants.map((value) => {
      const variant = record(value) || {}
      return {
        sku: scalar(variant.sku),
        selection: Array.isArray(variant.selection)
          ? variant.selection.map((entry) => {
            const selection = record(entry) || {}
            return { option: scalar(selection.option), value: scalar(selection.value) }
          })
          : variant.selection,
        priceMode: scalar(variant.priceMode),
        priceCents: scalar(variant.priceCents),
        status: scalar(variant.status),
        mediaKeys: Array.isArray(variant.mediaKeys)
          ? variant.mediaKeys.map((entry) => {
            const mediaKey = record(entry) || {}
            return { key: scalar(mediaKey.key) }
          })
          : variant.mediaKeys,
      }
    })
    : document.variants

  return {
    id: scalar(document.id),
    slug: scalar(document.slug),
    code: scalar(document.code),
    title: scalar(document.title),
    subtitle: scalar(document.subtitle),
    _status: scalar(document._status),
    catalogStatus: scalar(document.catalogStatus),
    availability: scalar(document.availability),
    material: scalar(document.material),
    edition: scalar(document.edition),
    description: scalar(document.description),
    attributes,
    searchTerms,
    categories,
    gallery,
    priceMode: scalar(document.priceMode),
    basePriceCents: scalar(document.basePriceCents),
    optionDefinitions,
    variants,
    seo: projectSEO(document.seo, `${path}.seo`),
  }
}

function projectCategory(document: PublicRecord, path = 'category'): unknown {
  const menu = document.menu === undefined ? undefined : document.menu === null ? null : record(document.menu)
  const listingRules = document.listingRules === undefined ? undefined : document.listingRules === null ? null : record(document.listingRules)
  const collectionPage = document.collectionPage === undefined ? undefined : document.collectionPage === null ? null : record(document.collectionPage)
  const contentBlocks = Array.isArray(document.contentBlocks)
    ? document.contentBlocks.map(canonicalValue)
    : document.contentBlocks
  const menuHighlights = Array.isArray(document.menuHighlights)
    ? document.menuHighlights.map((value, index) => {
      const highlight = record(value) || {}
      return {
        title: scalar(highlight.title),
        eyebrow: scalar(highlight.eyebrow),
        description: scalar(highlight.description),
        image: projectMedia(highlight.image, `${path}.menuHighlights.${index}.image`),
        linkLabel: scalar(highlight.linkLabel),
        destination: relationID(highlight.destination, `${path}.menuHighlights.${index}.destination`),
        externalURL: scalar(highlight.externalURL),
      }
    })
    : document.menuHighlights

  return {
    id: scalar(document.id),
    title: scalar(document.title),
    slug: scalar(document.slug),
    status: scalar(document.status),
    _status: scalar(document._status),
    description: scalar(document.description),
    order: scalar(document.order),
    parent: relationID(document.parent, `${path}.parent`),
    image: projectMedia(document.image, `${path}.image`),
    nodeType: scalar(document.nodeType),
    taxonomyAxis: scalar(document.taxonomyAxis),
    menu: menu && typeof menu === 'object' ? canonicalValue(menu) : menu,
    listingMode: scalar(document.listingMode),
    listingRules: listingRules && typeof listingRules === 'object' ? canonicalValue(listingRules) : listingRules,
    collectionPage: collectionPage && typeof collectionPage === 'object' ? canonicalValue(collectionPage) : collectionPage,
    contentBlocks,
    menuHighlights,
    externalURL: scalar(document.externalURL),
    hubPath: scalar(document.hubPath),
    seo: projectSEO(document.seo, `${path}.seo`),
  }
}

function projectHome(document: PublicRecord): unknown {
  const disabledSections = Array.isArray(document.disabledSections)
    ? [...document.disabledSections].map(String).sort()
    : document.disabledSections

  const heroSlides = Array.isArray(document.heroSlides)
    ? document.heroSlides.map((value, index) => {
      const slide = record(value) || {}
      return {
        desktopImage: projectImageField(slide.desktopImage, `home.heroSlides.${index}.desktopImage`),
        mobileImage: projectImageField(slide.mobileImage, `home.heroSlides.${index}.mobileImage`),
        statement: scalar(slide.statement),
        callToAction: projectCTA(slide.callToAction),
        active: scalar(slide.active),
      }
    })
    : document.heroSlides

  const selectedProducts = Array.isArray(document.selectedProducts)
    ? document.selectedProducts.map((value, index) => relationID(value, `home.selectedProducts.${index}`))
    : document.selectedProducts

  const matterPanels = Array.isArray(document.matterPanels)
    ? document.matterPanels.map((value, index) => {
      const panel = record(value) || {}
      return {
        category: projectCategorySummary(panel.category, `home.matterPanels.${index}.category`),
        image: projectImageField(panel.image, `home.matterPanels.${index}.image`),
        eyebrow: scalar(panel.eyebrow),
        headline: scalar(panel.headline),
        copy: scalar(panel.copy),
        callToAction: projectCTA(panel.callToAction),
      }
    })
    : document.matterPanels

  const signatureSlides = Array.isArray(document.signatureSlides)
    ? document.signatureSlides.map((value, index) => {
      const slide = record(value) || {}
      const product = populatedRelation(slide.product, `home.signatureSlides.${index}.product`)
      return {
        product: product === undefined || product === null
          ? product
          : projectProduct(product, `home.signatureSlides.${index}.product`),
        eyebrow: scalar(slide.eyebrow),
        headline: scalar(slide.headline),
        copy: scalar(slide.copy),
      }
    })
    : document.signatureSlides

  const provenanceSteps = Array.isArray(document.provenanceSteps)
    ? document.provenanceSteps.map((value, index) => {
      const step = record(value) || {}
      return {
        title: scalar(step.title),
        copy: scalar(step.copy),
        image: projectImageField(step.image, `home.provenanceSteps.${index}.image`),
        alt: scalar(step.alt),
      }
    })
    : document.provenanceSteps

  return {
    _status: scalar(document._status),
    disabledSections,
    heroMode: scalar(document.heroMode),
    heroSlides,
    autoplay: scalar(document.autoplay),
    autoplaySeconds: scalar(document.autoplaySeconds),
    manifestoEyebrow: scalar(document.manifestoEyebrow),
    manifestoTitle: scalar(document.manifestoTitle),
    manifestoCopy: scalar(document.manifestoCopy),
    manifestoPrimaryImage: projectImageField(document.manifestoPrimaryImage, 'home.manifestoPrimaryImage'),
    manifestoSecondaryImage: projectImageField(document.manifestoSecondaryImage, 'home.manifestoSecondaryImage'),
    selectedProducts,
    matterPanels,
    signatureSlides,
    provenanceTitle: scalar(document.provenanceTitle),
    provenanceCopy: scalar(document.provenanceCopy),
    provenanceImage: projectImageField(document.provenanceImage, 'home.provenanceImage'),
    provenanceSteps,
    provenanceCallToAction: projectCTA(document.provenanceCallToAction),
    seo: projectSEO(document.seo, 'home.seo'),
  }
}

export function createPublicProjection(
  entity: PublicRevisionEntity,
  document: unknown,
): unknown {
  const source = record(document)
  if (!source) throw new PublicRevisionProjectionError('O documento público possui formato inválido.', entity)

  const projection = entity === 'product'
    ? projectProduct(source)
    : entity === 'category'
    ? projectCategory(source)
    : projectHome(source)

  return canonicalValue(projection)
}

export function createPublicDocumentRevision(
  entity: PublicRevisionEntity,
  document: unknown,
): string {
  const projection = createPublicProjection(entity, document)
  return createHash('sha256').update(JSON.stringify(projection)).digest('hex')
}

export function createPublicPublicationMetadata(
  entity: PublicRevisionEntity,
  document: unknown,
): {
  revision: string
  contractVersion: typeof STOREFRONT_CONTRACT_VERSION
} {
  return {
    revision: createPublicDocumentRevision(entity, document),
    contractVersion: STOREFRONT_CONTRACT_VERSION,
  }
}
