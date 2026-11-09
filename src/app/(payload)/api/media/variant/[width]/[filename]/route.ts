import { NextResponse, type NextRequest } from 'next/server'

import {
  canConvert,
  createMediaVariant,
  parseVariantFilename,
  parseVariantWidth,
} from '@/server/media/variant'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const IMMUTABLE = 'public, max-age=31536000, s-maxage=31536000, immutable'

type Context = { params: Promise<{ width: string; filename: string }> }

function image(bytes: Uint8Array, contentType: string) {
  // Em stream, a resposta pode passar do limite de 4,5 MB de uma função na Vercel.
  return new Response(new Blob([bytes as BlobPart]).stream(), {
    headers: {
      'Cache-Control': IMMUTABLE,
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

/**
 * GET /api/media/variant/:width/:filename
 *
 * Versão WebP reduzida de uma imagem pública. Cada variante é gerada uma vez e
 * fica no CDN. Se a conversão falhar, o visitante recebe a imagem original.
 */
export async function GET(request: NextRequest, context: Context) {
  const params = await context.params
  const width = parseVariantWidth(params.width)
  const filename = parseVariantFilename(params.filename)
  if (!width || !filename) {
    return NextResponse.json({ error: 'invalid_media_variant' }, {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const original = new URL(`/api/media/file/${encodeURIComponent(filename)}`, request.nextUrl.origin)
  const redirectToOriginal = () => new Response(null, {
    status: 302,
    headers: { 'Cache-Control': 'no-store', Location: original.toString() },
  })

  try {
    const source = await fetch(original, { cache: 'no-store' })
    if (source.status === 404) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })
    if (!source.ok) return redirectToOriginal()

    const contentType = source.headers.get('content-type') ?? ''
    const bytes = Buffer.from(await source.arrayBuffer())
    if (!canConvert(contentType, bytes.length)) return redirectToOriginal()

    const variant = await createMediaVariant(bytes, contentType, width)
    return variant ? image(variant, 'image/webp') : image(bytes, contentType)
  } catch {
    return redirectToOriginal()
  }
}
