import { describe, expect, it } from 'vitest'

import { isBlockedRemoteAddress } from '../../src/server/domain/products/mediaFetch'

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
