import sharp from 'sharp'

export const MEDIA_VARIANT_WIDTHS = [480, 800, 1200, 1600, 2000] as const

const MAX_SOURCE_BYTES = 30 * 1024 * 1024
const CONVERTIBLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'])

export function parseVariantWidth(value: string): number | null {
  const width = Number(value)
  return (MEDIA_VARIANT_WIDTHS as readonly number[]).includes(width) ? width : null
}

/** O nome vira um segmento de `/api/media/file/`; nada pode escapar desse caminho. */
export function parseVariantFilename(value: string): string | null {
  let name: string
  try {
    name = decodeURIComponent(value)
  } catch {
    return null
  }
  if (!name || name.length > 255 || name === '.' || name === '..') return null
  return /[/\\\u0000-\u001f]/.test(name) ? null : name
}

export function canConvert(contentType: string, bytes: number): boolean {
  return bytes <= MAX_SOURCE_BYTES && CONVERTIBLE_TYPES.has(contentType.split(';')[0]!.trim().toLowerCase())
}

/**
 * Gera a variante WebP sem cortar nem ampliar. Devolve `null` se o original já
 * for menor, e nesse caso quem chamou entrega o próprio original.
 */
export async function createMediaVariant(source: Buffer, contentType: string, width: number): Promise<Buffer | null> {
  const animated = contentType.split(';')[0]!.trim().toLowerCase() === 'image/gif'
  const image = sharp(source, { animated })
  // Sem metadados na saída, a orientação da câmera precisa ser aplicada aqui.
  if (!animated) image.rotate()
  const output = await image
    .resize({ width, withoutEnlargement: true })
    .webp(animated ? { quality: 70, effort: 2 } : { quality: 80 })
    .toBuffer()
  return output.length < source.length ? output : null
}
