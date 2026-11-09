import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import {
  canConvert,
  createMediaVariant,
  parseVariantFilename,
  parseVariantWidth,
} from '@/server/media/variant'

const noisy = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#887766', noise: { type: 'gaussian', mean: 120, sigma: 30 } } })

describe('variantes de mídia', () => {
  it('aceita somente as larguras combinadas', () => {
    expect(parseVariantWidth('800')).toBe(800)
    for (const width of ['799', '0', '-800', '800.5', 'abc', '']) expect(parseVariantWidth(width)).toBeNull()
  })

  it('aceita nomes reais e recusa saída do caminho', () => {
    expect(parseVariantFilename('IMG_0103%20(1).gif')).toBe('IMG_0103 (1).gif')
    expect(parseVariantFilename('foto-w1200')).toBe('foto-w1200')
    for (const name of ['..', '.', '', 'a/b.png', 'a%2Fb.png', 'a%5Cb.png', '%00.png', '%E0%A4%A']) {
      expect(parseVariantFilename(name)).toBeNull()
    }
  })

  it('só converte imagens dentro do limite', () => {
    expect(canConvert('image/png', 1000)).toBe(true)
    expect(canConvert('IMAGE/JPEG; charset=binary', 1000)).toBe(true)
    expect(canConvert('text/html', 1000)).toBe(false)
    expect(canConvert('image/svg+xml', 1000)).toBe(false)
    expect(canConvert('image/png', 31 * 1024 * 1024)).toBe(false)
  })

  it('reduz em WebP mantendo a proporção', async () => {
    const source = await noisy(3000, 2000).jpeg({ quality: 95 }).toBuffer()
    const output = await createMediaVariant(source, 'image/jpeg', 800)
    const meta = await sharp(output!).metadata()
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 800, 533])
  })

  it('não amplia foto pequena', async () => {
    const source = await noisy(300, 200).png().toBuffer()
    const output = await createMediaVariant(source, 'image/png', 1600)
    expect((await sharp(output!).metadata()).width).toBe(300)
  })

  it('aplica a orientação da câmera', async () => {
    const source = await noisy(1200, 600).withMetadata({ orientation: 6 }).jpeg({ quality: 95 }).toBuffer()
    const meta = await sharp((await createMediaVariant(source, 'image/jpeg', 480))!).metadata()
    expect([meta.width, meta.height]).toEqual([480, 960])
  })

  it('mantém a animação do GIF', async () => {
    const parts = await Promise.all(['#aa2222', '#22aa22', '#2222aa'].map((background) =>
      sharp({ create: { width: 200, height: 400, channels: 3, background } }).png().toBuffer()))
    const frames = await sharp(parts, { join: { animated: true } }).gif().toBuffer()
    const meta = await sharp((await createMediaVariant(frames, 'image/gif', 800))!, { animated: true }).metadata()
    expect([meta.format, meta.pages]).toEqual(['webp', 3])
  })

  it('devolve nulo quando o original já é menor', async () => {
    const source = await noisy(100, 100).webp({ quality: 1 }).toBuffer()
    expect(await createMediaVariant(source, 'image/webp', 480)).toBeNull()
  })
})
