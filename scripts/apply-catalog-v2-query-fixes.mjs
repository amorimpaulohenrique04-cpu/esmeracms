import { readFileSync, writeFileSync } from 'node:fs'

function edit(path, transform) {
  const before = readFileSync(path, 'utf8')
  const after = transform(before)
  if (after !== before) writeFileSync(path, after)
}

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source
  if (!source.includes(before)) throw new Error(`Patch não encontrado: ${label}`)
  return source.replace(before, after)
}

edit('src/server/storefront-v2/catalog.ts', (source) => {
  source = replaceOnce(
    source,
    "  if (listingMode === 'descendants') {\n    listingWhere = { categories: { in: descendantIDs(rootID, categories) } }",
    "  if (listingMode === 'descendants') {\n    listingWhere = relationshipFilter(descendantIDs(rootID, categories)) || { categories: { contains: rootID } }",
    'descendant relationship query',
  )
  source = replaceOnce(
    source,
    "  if (page > Math.max(1, result.totalPages) && result.totalDocs > 0) throw new StorefrontNotFoundError('Página da coleção inexistente.')",
    "  if (page > Math.max(1, result.totalPages)) throw new StorefrontNotFoundError('Página da coleção inexistente.')",
    'missing collection page validation',
  )
  source = replaceOnce(
    source,
    "  const facetProducts = facetResult.docs as unknown as UnknownRecord[]\n  const categoryMap = mapByID(categories)",
    "  const facetsTruncated = facetResult.totalDocs > MAX_FACET_PRODUCTS\n  const facetProducts = facetsTruncated ? [] : facetResult.docs as unknown as UnknownRecord[]\n  const categoryMap = mapByID(categories)",
    'facet truncation detection',
  )
  source = replaceOnce(
    source,
    "    facets: buildFacets(facetProducts, visibleFilters),",
    "    facets: facetsTruncated ? {} : buildFacets(facetProducts, visibleFilters),",
    'omit partial facet counts',
  )
  return source
})

edit('src/scripts/seed-catalog-taxonomy.ts', (source) => replaceOnce(
  source,
  "        listingRules: node.availability ? { availability: node.availability, productStatus: ['active'] } : undefined,",
  "        listingRules: node.availability || node.key === 'new'\n          ? { availability: node.availability || [], productStatus: ['active'], sort: node.key === 'new' ? 'newest' : 'editorial' }\n          : undefined,",
  'new arrivals controlled listing rule',
))
