import { dangerouslyDeleteByTag } from '@vercel/functions'
import { revalidateTag } from 'next/cache'
import { after } from 'next/server'
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
  PayloadRequest,
} from 'payload'

export const STOREFRONT_CACHE_TAGS = {
  bootstrap: 'storefront-bootstrap',
  navigation: 'storefront-navigation',
  collections: 'storefront-collections',
  products: 'storefront-products',
  pages: 'storefront-pages',
} as const

export type StorefrontCacheTag = (typeof STOREFRONT_CACHE_TAGS)[keyof typeof STOREFRONT_CACHE_TAGS]
export type StorefrontContentKind = 'category' | 'product' | 'navigation' | 'home' | 'site-settings' | 'collection-page'

const { bootstrap, navigation, collections, products, pages } = STOREFRONT_CACHE_TAGS

/** Qual leitura pública depende de cada tipo de conteúdo. */
const TAGS_BY_KIND: Record<StorefrontContentKind, StorefrontCacheTag[]> = {
  category: [bootstrap, navigation, collections, products, pages],
  product: [bootstrap, collections, products],
  navigation: [bootstrap, navigation],
  home: [bootstrap],
  'site-settings': [bootstrap, navigation, collections, products],
  'collection-page': [collections, products],
}

/** Lotes (reordenar, importar) pedem uma única invalidação ao final. */
export const SKIP_STOREFRONT_INVALIDATION = 'skipStorefrontInvalidation'

type VersionedDocument = { _status?: string | null } | null | undefined

/** Rascunho que nunca foi público não altera o que o site lê. */
export function affectsPublicContent(doc: VersionedDocument, previousDoc?: VersionedDocument) {
  if (!doc || doc._status === undefined) return true
  return doc._status === 'published' || previousDoc?._status === 'published'
}

async function flushStorefrontTags(tags: StorefrontCacheTag[]) {
  const results = await Promise.allSettled([
    ...tags.map(async (tag) => revalidateTag(tag, { expire: 0 })),
    dangerouslyDeleteByTag(tags),
  ])
  const failures = results.flatMap((result) => result.status === 'rejected'
    ? [result.reason instanceof Error ? result.reason.message : 'unknown_error']
    : [])

  if (failures.length) {
    console.error({ event: 'storefront.invalidation.failed', tags, failures })
    return
  }
  console.info({ event: 'storefront.invalidation.flushed', tags })
}

const pendingByRequest = new WeakMap<object, Set<StorefrontCacheTag>>()

/**
 * Agenda a limpeza para depois da resposta. O hook roda dentro da transação:
 * limpar antes do commit deixaria a próxima leitura recolocar o dado antigo.
 */
export function scheduleStorefrontInvalidation(kind: StorefrontContentKind, req?: PayloadRequest) {
  const tags = TAGS_BY_KIND[kind]
  const pending = req ? pendingByRequest.get(req) : undefined
  if (pending) {
    tags.forEach((tag) => pending.add(tag))
    return
  }

  const batch = new Set(tags)
  if (req) pendingByRequest.set(req, batch)
  try {
    after(() => {
      if (req) pendingByRequest.delete(req)
      return flushStorefrontTags(Array.from(batch))
    })
  } catch (error) {
    if (req) pendingByRequest.delete(req)
    // Scripts e CLI não têm requisição; o TTL curto cobre esse caminho.
    console.warn({
      event: 'storefront.invalidation.skipped',
      kind,
      reason: error instanceof Error ? error.message : 'no_request_scope',
    })
  }
}

export function invalidateStorefrontAfterChange(kind: StorefrontContentKind): CollectionAfterChangeHook {
  return ({ doc, previousDoc, req, context }) => {
    if (!context[SKIP_STOREFRONT_INVALIDATION] && affectsPublicContent(doc, previousDoc)) {
      scheduleStorefrontInvalidation(kind, req)
    }
    return doc
  }
}

export function invalidateStorefrontAfterDelete(kind: StorefrontContentKind): CollectionAfterDeleteHook {
  return ({ doc, req, context }) => {
    if (!context[SKIP_STOREFRONT_INVALIDATION]) scheduleStorefrontInvalidation(kind, req)
    return doc
  }
}

export function invalidateStorefrontAfterGlobalChange(kind: StorefrontContentKind): GlobalAfterChangeHook {
  return ({ doc, previousDoc, req, context }) => {
    if (!context[SKIP_STOREFRONT_INVALIDATION] && affectsPublicContent(doc, previousDoc)) {
      scheduleStorefrontInvalidation(kind, req)
    }
    return doc
  }
}
