const PUBLIC_STOREFRONT_QUERY_KEYS = [
  'page',
  'limit',
  'sort',
  'q',
  'category',
  'collection',
  'environment',
  'piece_type',
  'type',
  'material',
  'availability',
  'min',
  'max',
] as const

/**
 * Keep cache identity aligned with the public storefront contract.
 * Unknown/tracking params do not affect the response and therefore must not
 * create distinct runtime-cache entries.
 */
export function canonicalStorefrontQuery(searchParams: URLSearchParams): string {
  const canonical = new URLSearchParams()
  for (const key of PUBLIC_STOREFRONT_QUERY_KEYS) {
    for (const value of searchParams.getAll(key)) canonical.append(key, value)
  }
  return canonical.toString()
}
