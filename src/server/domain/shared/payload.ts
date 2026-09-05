import type { PayloadRequest, Where } from 'payload'

import { measureServerOperation } from '../../performance'

export type FindOptions = {
  where?: Where
  sort?: string | string[]
  limit?: number
  page?: number
  depth?: number
  draft?: boolean
  select?: Record<string, true>
}

export async function findDocs<T>(req: PayloadRequest, collection: string, options: FindOptions = {}) {
  return await measureServerOperation('operational', `${collection}.find`, async () => {
    const result = await req.payload.find({
      collection: collection as never,
      depth: options.depth ?? 1,
      limit: options.limit ?? 100,
      page: options.page,
      sort: options.sort as never,
      where: options.where,
      overrideAccess: false,
      user: req.user,
      req,
      draft: options.draft,
      select: options.select as never,
    })

    return result as unknown as {
      docs: T[]
      hasNextPage: boolean
      limit: number
      page: number
      totalDocs: number
      totalPages: number
    }
  })
}

export async function findAllDocs<T>(
  req: PayloadRequest,
  collection: string,
  options: Omit<FindOptions, 'limit' | 'page'> = {},
) {
  const firstPage = await findDocs<T>(req, collection, { ...options, limit: 500, page: 1 })
  if (!firstPage.hasNextPage) return firstPage.docs

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
      findDocs<T>(req, collection, { ...options, limit: 500, page: index + 2 }),
    ),
  )

  return [firstPage, ...remainingPages].flatMap((result) => result.docs)
}

export async function countDocs(req: PayloadRequest, collection: string, where?: Where) {
  return await measureServerOperation('operational', `${collection}.count`, async () => {
    const result = await req.payload.count({
      collection: collection as never,
      where,
      overrideAccess: false,
      user: req.user,
      req,
    })

    return result.totalDocs
  })
}
