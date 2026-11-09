import { describe, expect, it, vi } from 'vitest'

import { fetchRemoteImage, isBlockedRemoteAddress } from '../../src/server/domain/products/mediaFetch'

describe('product import media SSRF guard', () => {
  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.10',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    'fc00::1',
    'fd12::1',
    'fe80::1',
    '::ffff:127.0.0.1',
  ])('bloqueia endereço privado/reservado %s', (address) => {
    expect(isBlockedRemoteAddress(address)).toBe(true)
  })

  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])('aceita endereço público %s', (address) => {
    expect(isBlockedRemoteAddress(address)).toBe(false)
  })
})

it('aplica um único prazo a todos os redirecionamentos da imagem', async () => {
  const timeout = new AbortController()
  const timer = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal)
  const fetchImage = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://8.8.8.8/photo.png' } }))
    .mockImplementationOnce(async () => {
      timeout.abort(new DOMException('Timeout', 'TimeoutError'))
      throw timeout.signal.reason
    })
  vi.stubGlobal('fetch', fetchImage)
  try {
    await expect(fetchRemoteImage('https://1.1.1.1/photo.png')).rejects.toThrow('15 segundos')
    expect(timer).toHaveBeenCalledExactlyOnceWith(15_000)
    expect(fetchImage).toHaveBeenCalledTimes(2)
    expect(fetchImage.mock.calls.every(([, options]) => options?.signal === timeout.signal)).toBe(true)
  } finally {
    timer.mockRestore()
    vi.unstubAllGlobals()
  }
})
