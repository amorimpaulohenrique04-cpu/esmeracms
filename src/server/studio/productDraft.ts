import type { Payload, PayloadRequest } from 'payload'

import { RevisionConflictError } from '../publication/types'

/** Versão do contrato anunciada ao Esméra Studio em `studio-capabilities`. */
export const STUDIO_DRAFT_VERSION = 2

export class StudioInputError extends Error {}

type Source = Record<string, unknown>
type GalleryEntry = { image: string | number; mediaKey: string; role: string; alt: string }
type DraftData = Record<string, unknown> & { gallery?: GalleryEntry[] }

export function draftData(input: Source | undefined) {
  const source = input || {}
  const data: Source = {}
  const textFields = ['title', 'subtitle', 'material', 'edition'] as const
  for (const field of textFields) {
    if (typeof source[field] === 'string' || source[field] === null) data[field] = source[field]
  }
  if (typeof source.availability === 'string') data.availability = source.availability
  if (typeof source.priceMode === 'string') data.priceMode = source.priceMode
  if (typeof source.basePriceCents === 'number' || source.basePriceCents === null) data.basePriceCents = source.basePriceCents
  const specs = source.physicalSpecs
  if (specs && typeof specs === 'object' && !Array.isArray(specs)) {
    const specsRecord = specs as Record<string, unknown>
    const physicalSpecs: Record<string, number | null> = {}
    for (const field of ['heightMm', 'widthMm', 'depthMm', 'weightGrams'] as const) {
      const value = specsRecord[field]
      if (typeof value === 'number' || value === null) physicalSpecs[field] = value
    }
    data.physicalSpecs = physicalSpecs
  }
  data._status = 'draft'
  return data
}

const validID = (value: unknown) => typeof value === 'number'
  ? Number.isSafeInteger(value) && value > 0
  : typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value)

function lexicalFromText(text: string) {
  return {
    root: {
      type: 'root', format: '', indent: 0, version: 1, direction: 'ltr',
      children: text.split(/\r?\n/).map((line) => ({
        type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr',
        children: line ? [{ type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text: line, version: 1 }] : [],
      })),
    },
  }
}

/**
 * Entrada do Studio. Campo ausente significa "manter o valor atual": a ficha só
 * envia o que mudou, para não apagar formatação ou dados que ela não representa.
 */
export function studioDraftData(source: Source | undefined): DraftData {
  if (!source) throw new StudioInputError('Informe os dados do produto.')
  const data: DraftData = draftData(source)

  if (source.catalogStatus !== undefined) {
    if (source.catalogStatus !== 'active' && source.catalogStatus !== 'archived') {
      throw new StudioInputError('Status de catálogo inválido.')
    }
    data.catalogStatus = source.catalogStatus
  }

  if (source.categories !== undefined) {
    if (!Array.isArray(source.categories) || source.categories.length > 100 ||
        !source.categories.every(validID) || new Set(source.categories.map(String)).size !== source.categories.length) {
      throw new StudioInputError('Categorias inválidas.')
    }
    data.categories = source.categories
  }

  if (source.attributes !== undefined) {
    if (!Array.isArray(source.attributes) || source.attributes.length > 100) throw new StudioInputError('Ficha técnica inválida.')
    data.attributes = source.attributes.map((value) => {
      const field = value as { label?: unknown; value?: unknown } | null
      if (typeof field?.label !== 'string' || !field.label.trim() || field.label.length > 500 ||
          typeof field.value !== 'string' || !field.value.trim() || field.value.length > 4000) {
        throw new StudioInputError('Preencha nome e valor dos atributos.')
      }
      return { label: field.label, value: field.value }
    })
  }

  if (source.descriptionText !== undefined) {
    if (typeof source.descriptionText !== 'string' || source.descriptionText.length > 80_000) {
      throw new StudioInputError('Descrição inválida.')
    }
    data.description = source.descriptionText ? lexicalFromText(source.descriptionText) : null
  }

  if (source.gallery !== undefined) {
    if (!Array.isArray(source.gallery) || source.gallery.length > 12 ||
        (source.catalogStatus === 'active' && source.gallery.length === 0)) {
      throw new StudioInputError('Revise as fotografias da galeria.')
    }
    const keys = new Set<string>()
    data.gallery = source.gallery.map((value, index) => {
      const item = value as { image?: unknown; mediaKey?: unknown; alt?: unknown } | null
      if (!item || !validID(item.image) || typeof item.mediaKey !== 'string' ||
          !/^[a-zA-Z0-9_-]{1,80}$/.test(item.mediaKey) || keys.has(item.mediaKey) ||
          typeof item.alt !== 'string' || !item.alt.trim() || item.alt.length > 180) {
        throw new StudioInputError('Revise as informações de cada fotografia.')
      }
      keys.add(item.mediaKey)
      return { image: item.image as string | number, mediaKey: item.mediaKey, role: index === 0 ? 'cover' : 'detail', alt: item.alt }
    })
  }

  return data
}

type VariantKeys = { variants?: Array<{ mediaKeys?: Array<{ key?: string | null }> | null }> | null }

/** A galeria nova precisa manter as imagens usadas por variantes e só aponta para mídia publicada. */
export async function assertStudioGallery(
  payload: Payload,
  user: PayloadRequest['user'],
  current: unknown,
  data: DraftData,
) {
  if (!Array.isArray(data.gallery)) return
  const keys = new Set(data.gallery.map((item) => item.mediaKey))
  const variants = (current as VariantKeys | null)?.variants || []
  if (variants.some((variant) => (variant.mediaKeys || []).some(({ key }) => Boolean(key) && !keys.has(String(key))))) {
    throw new RevisionConflictError('Uma foto removida é usada por uma variante do produto. Revise as imagens no painel.')
  }
  const images = data.gallery.map((item) => item.image)
  if (!images.length) return
  const media = await payload.find({
    collection: 'media',
    depth: 0,
    limit: images.length,
    overrideAccess: false,
    user,
    where: { and: [{ id: { in: images } }, { _status: { equals: 'published' } }] },
  })
  if (media.docs.length !== new Set(images.map(String)).size) {
    throw new RevisionConflictError('Uma fotografia não está disponível na biblioteca de mídia.')
  }
}
