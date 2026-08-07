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

edit('src/server/publication/publicRevision.ts', (source) => {
  source = replaceOnce(
    source,
    `  const menu = record(document.menu)
  const listingRules = record(document.listingRules)
  const collectionPage = record(document.collectionPage)`,
    `  const menu = document.menu === undefined ? undefined : document.menu === null ? null : record(document.menu)
  const listingRules = document.listingRules === undefined ? undefined : document.listingRules === null ? null : record(document.listingRules)
  const collectionPage = document.collectionPage === undefined ? undefined : document.collectionPage === null ? null : record(document.collectionPage)`,
    'preserve absent category revision fields',
  )
  source = replaceOnce(
    source,
    `    menu: menu ? canonicalValue(menu) : menu,
    listingMode: scalar(document.listingMode),
    listingRules: listingRules ? canonicalValue(listingRules) : listingRules,
    collectionPage: collectionPage ? canonicalValue(collectionPage) : collectionPage,`,
    `    menu: menu && typeof menu === 'object' ? canonicalValue(menu) : menu,
    listingMode: scalar(document.listingMode),
    listingRules: listingRules && typeof listingRules === 'object' ? canonicalValue(listingRules) : listingRules,
    collectionPage: collectionPage && typeof collectionPage === 'object' ? canonicalValue(collectionPage) : collectionPage,`,
    'canonicalize nullable category revision fields',
  )
  return source
})

edit('src/admin/design-system/design-system.scss', (source) => replaceOnce(
  source,
  `@media (prefers-reduced-motion: reduce) {
  .esmera-funnel-stepper { scroll-behavior: auto; }
  .esmera-funnel-stepper a,
  .esmera-funnel-stepper__connector { transition: none; }
}

`,
  '',
  'remove duplicated reduced-motion policy',
))

edit('src/admin/design-system/tokens.scss', (source) => replaceOnce(
  source,
  `  .esmera-section-nav__link,
  .esmera-quick-actions__item,`,
  `  .esmera-section-nav__link,
  .esmera-funnel-stepper,
  .esmera-funnel-stepper a,
  .esmera-funnel-stepper__connector,
  .esmera-quick-actions__item,`,
  'move funnel stepper into canonical reduced-motion policy',
))

edit('tests/unit/category-detail-editor.unit.spec.ts', (source) => replaceOnce(
  source,
  `    expect(Object.keys(bodies[0].data ?? {}).sort()).toEqual([
      'description', 'image', 'order', 'parent', 'searchTerms', 'seo', 'slug', 'status', 'title',
    ])`,
  `    expect(Object.keys(bodies[0].data ?? {}).sort()).toEqual([
      'collectionPage', 'description', 'externalURL', 'hubPath', 'image', 'listingMode', 'listingRules',
      'menu', 'nodeType', 'order', 'parent', 'searchTerms', 'seo', 'slug', 'status', 'taxonomyAxis', 'title',
    ])
    expect(bodies[0].data).not.toHaveProperty('products')
    expect(bodies[0].data).not.toHaveProperty('productCount')`,
  'category mutation fields',
))

edit('tests/unit/storefront-v2-catalog.unit.spec.ts', (source) => replaceOnce(
  source,
  `  collectionPage: { visibleFilters: ['category'], defaultSort: 'editorial', productsPerPage: 24, showProductCount: true, layout: 'grid' },`,
  `  collectionPage: { visibleFilters: ['category', 'material', 'price'], defaultSort: 'editorial', productsPerPage: 24, showProductCount: true, layout: 'grid' },`,
  'collection test visible filters',
))
