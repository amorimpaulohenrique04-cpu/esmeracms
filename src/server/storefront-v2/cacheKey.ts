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
 * Storefront builders intentionally ignore unknown query parameters. The cache
 * key must do the same, otherwise tracking/protection parameters fragment the
 * cache even though they produce identical public data.
 */
export function canonicalStorefrontQuery(searchParams: URLSearchParams): string {
  const canonical = new URLSearchParams()
  for (const key of PUBLIC_STOREFRONT_QUERY_KEYS) {
    for (const value of searchParams.getAll(key)) canonical.append(key, value)
  }
  return canonical.toString()
}
