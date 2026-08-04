import type { Payload, PayloadRequest } from 'payload'

import {
  createPublicPublicationMetadata,
  PublicRevisionProjectionError,
  type PublicRevisionEntity,
} from './publicRevision'

type StampableEntity = Extract<PublicRevisionEntity, 'product' | 'category'>
type StampableCollection = 'products' | 'categories'

type PublicDocument = Record<string, unknown>

function record(value: unknown): PublicDocument | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as PublicDocument
    : null
}

export async function stampPublishedDocumentMetadata(input: {
  payload: Payload
  entity: StampableEntity
  collection: StampableCollection
  id: string | number
  user: PayloadRequest['user']
  document?: unknown
}): Promise<unknown> {
  let published = record(input.document)
  if (!published) {
    published = record(await input.payload.findByID({
      collection: input.collection,
      id: input.id,
      depth: 2,
      draft: false,
      overrideAccess: true,
      user: input.user,
    }))
  }
  if (!published || published._status !== 'published') return published

  let metadata: ReturnType<typeof createPublicPublicationMetadata>
  try {
    metadata = createPublicPublicationMetadata(input.entity, published)
  } catch (error) {
    if (!(error instanceof PublicRevisionProjectionError)) throw error
    published = record(await input.payload.findByID({
      collection: input.collection,
      id: input.id,
      depth: 2,
      draft: false,
      overrideAccess: true,
      user: input.user,
    }))
    if (!published || published._status !== 'published') return published
    metadata = createPublicPublicationMetadata(input.entity, published)
  }

  if (
    published.publicationRevision === metadata.revision &&
    published.publicationContractVersion === metadata.contractVersion
  ) {
    return published
  }

  return await input.payload.update({
    collection: input.collection,
    id: input.id,
    data: {
      publicationRevision: metadata.revision,
      publicationContractVersion: metadata.contractVersion,
    } as never,
    draft: false,
    depth: 2,
    overrideAccess: true,
    user: input.user,
    context: { skipPublicRevisionStamp: true },
  })
}

export async function stampPublishedHomeMetadata({
  doc,
  req,
}: {
  doc: unknown
  req: PayloadRequest
}): Promise<unknown> {
  const context = (req.context || {}) as Record<string, unknown>
  const current = record(doc)
  if (context.skipPublicRevisionStamp || current?._status !== 'published') return doc

  const publishedHome = record(await req.payload.findGlobal({
    slug: 'home',
    depth: 2,
    draft: false,
    overrideAccess: true,
    req,
  }))
  if (!publishedHome || publishedHome._status !== 'published') return doc

  const metadata = createPublicPublicationMetadata('home', publishedHome)
  if (
    publishedHome.publicationRevision === metadata.revision &&
    publishedHome.publicationContractVersion === metadata.contractVersion
  ) {
    return doc
  }

  await req.payload.updateGlobal({
    slug: 'home',
    data: {
      publicationRevision: metadata.revision,
      publicationContractVersion: metadata.contractVersion,
    } as never,
    draft: false,
    overrideAccess: true,
    req,
    context: {
      ...context,
      skipPublicRevisionStamp: true,
    },
  })

  return doc
}
