import { createHash } from 'node:crypto'

import { NextResponse } from 'next/server'

export type PublicHTTPOptions = {
  revision?: string
  lastModified?: string | null
  maxAge?: number
  staleWhileRevalidate?: number
}

export function deterministicRevision(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function normalizeETag(revision: string) {
  return `"${revision}"`
}

export function publicCacheHeaders(options: PublicHTTPOptions) {
  const maxAge = Math.max(0, options.maxAge ?? 60)
  const staleWhileRevalidate = Math.max(0, options.staleWhileRevalidate ?? 300)
  const headers = new Headers({
    'Cache-Control': `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    Vary: 'Accept-Encoding',
  })
  if (options.revision) headers.set('ETag', normalizeETag(options.revision))
  if (options.lastModified) {
    const date = new Date(options.lastModified)
    if (!Number.isNaN(date.getTime())) headers.set('Last-Modified', date.toUTCString())
  }
  return headers
}

export function isNotModified(request: Request, options: PublicHTTPOptions) {
  if (options.revision) {
    const requestTag = request.headers.get('if-none-match')
    if (requestTag && requestTag.split(',').map((value) => value.trim()).includes(normalizeETag(options.revision))) return true
  }
  if (options.lastModified) {
    const since = request.headers.get('if-modified-since')
    const modifiedAt = new Date(options.lastModified).getTime()
    const sinceAt = since ? new Date(since).getTime() : Number.NaN
    if (Number.isFinite(modifiedAt) && Number.isFinite(sinceAt) && modifiedAt <= sinceAt) return true
  }
  return false
}

export function publicJSON<T>(request: Request, body: T, options: PublicHTTPOptions) {
  const headers = publicCacheHeaders(options)
  if (isNotModified(request, options)) return new NextResponse(null, { status: 304, headers })
  return NextResponse.json(body, { status: 200, headers })
}

export function publicError(status: 400 | 404 | 422 | 500, code: string, message: string) {
  return NextResponse.json(
    { error: { code, message } },
    {
      status,
      headers: {
        'Cache-Control': status === 404 ? 'public, max-age=30, stale-while-revalidate=60' : 'no-store',
      },
    },
  )
}
