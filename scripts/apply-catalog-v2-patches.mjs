import { readFileSync, writeFileSync } from 'node:fs'

function edit(path, transform) {
  const before = readFileSync(path, 'utf8')
  const after = transform(before)
  if (after !== before) writeFileSync(path, after)
}

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source
  if (!source.includes(before)) throw new Error(`Patch não encontrado: ${label}`)
  return source.replace(before, after)
}

edit('src/server/storefront-v2/catalog.ts', (source) => replaceRequired(
  source,
  "  const placement = value.placement === 'after' ? 'after' : 'before'\n",
  "  const placement: 'before' | 'after' = value.placement === 'after' ? 'after' : 'before'\n",
  'content block placement typing',
))

edit('src/collections/Categories.ts', (source) => {
  source = replaceRequired(
    source,
    "              name: 'nodeType',\n              type: 'select',\n              label: 'Tipo do nó',\n              required: true,\n              defaultValue: 'collection',",
    "              name: 'nodeType',\n              type: 'select',\n              label: 'Tipo do nó',\n              defaultValue: 'collection',",
    'optional nodeType for backwards-compatible writes',
  )
  source = replaceRequired(
    source,
    "              name: 'taxonomyAxis',\n              type: 'select',\n              label: 'Eixo taxonômico',\n              required: true,\n              defaultValue: 'navigation',",
    "              name: 'taxonomyAxis',\n              type: 'select',\n              label: 'Eixo taxonômico',\n              defaultValue: 'navigation',",
    'optional taxonomyAxis for backwards-compatible writes',
  )
  source = replaceRequired(
    source,
    "              name: 'listingMode',\n              type: 'select',\n              label: 'Modo de listagem',\n              required: true,\n              defaultValue: 'assigned',",
    "              name: 'listingMode',\n              type: 'select',\n              label: 'Modo de listagem',\n              defaultValue: 'assigned',",
    'optional listingMode for backwards-compatible writes',
  )
  return source
})

edit('src/collections/Products.ts', (source) => replaceRequired(
  source,
  "              hasMany: true,\n              label: 'Categorias',\n              validate:",
  "              hasMany: true,\n              label: 'Prateleiras e categorias',\n              filterOptions: {\n                and: [\n                  { status: { equals: 'active' } },\n                  { _status: { equals: 'published' } },\n                  { nodeType: { not_equals: 'group' } },\n                ],\n              },\n              admin: {\n                description: 'O produto pode aparecer em mais de uma prateleira. Agrupadores de menu não são selecionáveis.',\n              },\n              validate:",
  'product category field presentation',
))

edit('src/server/publication/publicRevision.ts', (source) => replaceRequired(
  source,
  `function projectCategory(document: PublicRecord, path = 'category'): unknown {
  return {
    id: scalar(document.id),
    title: scalar(document.title),
    slug: scalar(document.slug),
    status: scalar(document.status),
    _status: scalar(document._status),
    description: scalar(document.description),
    order: scalar(document.order),
    parent: relationID(document.parent, \`${'${path}'}.parent\`),
    image: projectMedia(document.image, \`${'${path}'}.image\`),
    seo: projectSEO(document.seo, \`${'${path}'}.seo\`),
  }
}`,
  `function projectCategory(document: PublicRecord, path = 'category'): unknown {
  const menu = record(document.menu)
  const listingRules = record(document.listingRules)
  const collectionPage = record(document.collectionPage)
  const contentBlocks = Array.isArray(document.contentBlocks)
    ? document.contentBlocks.map(canonicalValue)
    : document.contentBlocks
  const menuHighlights = Array.isArray(document.menuHighlights)
    ? document.menuHighlights.map((value, index) => {
      const highlight = record(value) || {}
      return {
        title: scalar(highlight.title),
        eyebrow: scalar(highlight.eyebrow),
        description: scalar(highlight.description),
        image: projectMedia(highlight.image, \`${'${path}'}.menuHighlights.${'${index}'}.image\`),
        linkLabel: scalar(highlight.linkLabel),
        destination: relationID(highlight.destination, \`${'${path}'}.menuHighlights.${'${index}'}.destination\`),
        externalURL: scalar(highlight.externalURL),
      }
    })
    : document.menuHighlights

  return {
    id: scalar(document.id),
    title: scalar(document.title),
    slug: scalar(document.slug),
    status: scalar(document.status),
    _status: scalar(document._status),
    description: scalar(document.description),
    order: scalar(document.order),
    parent: relationID(document.parent, \`${'${path}'}.parent\`),
    image: projectMedia(document.image, \`${'${path}'}.image\`),
    nodeType: scalar(document.nodeType),
    taxonomyAxis: scalar(document.taxonomyAxis),
    menu: menu ? canonicalValue(menu) : menu,
    listingMode: scalar(document.listingMode),
    listingRules: listingRules ? canonicalValue(listingRules) : listingRules,
    collectionPage: collectionPage ? canonicalValue(collectionPage) : collectionPage,
    contentBlocks,
    menuHighlights,
    externalURL: scalar(document.externalURL),
    hubPath: scalar(document.hubPath),
    seo: projectSEO(document.seo, \`${'${path}'}.seo\`),
  }
}`,
  'category public revision projection',
))

edit('src/server/storefront-contract/types.ts', (source) => {
  const exportLine = "\nexport * from '../storefront-v2/types'\n"
  return source.includes(exportLine.trim()) ? source : `${source.trimEnd()}${exportLine}`
})

edit('package.json', (source) => {
  if (source.includes('"seed:catalog-taxonomy"')) return source
  return replaceRequired(
    source,
    '    "payload": "cross-env NODE_OPTIONS=--no-deprecation payload",\n',
    '    "payload": "cross-env NODE_OPTIONS=--no-deprecation payload",\n    "seed:catalog-taxonomy": "cross-env NODE_OPTIONS=--no-deprecation tsx src/scripts/seed-catalog-taxonomy.ts",\n',
    'catalog taxonomy seed script',
  )
})
