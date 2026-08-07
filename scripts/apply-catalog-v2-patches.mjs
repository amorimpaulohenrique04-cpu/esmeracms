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

edit('src/app/(payload)/api/admin-categories/route.ts', (source) => {
  source = replaceRequired(
    source,
    "}\n\n\nfunction categoryDraftData(input: Record<string, unknown> | undefined) {",
    `}

const CATEGORY_NODE_TYPES = new Set(['collection', 'editorial', 'external', 'group'])
const CATEGORY_AXES = new Set(['navigation', 'piece_type', 'collection', 'environment', 'campaign', 'service'])
const CATEGORY_LISTING_MODES = new Set(['assigned', 'descendants', 'rules', 'hybrid'])
const CATEGORY_SORTS = new Set(['editorial', 'newest', 'price_asc', 'price_desc', 'name_asc'])
const CATEGORY_FILTERS = new Set(['category', 'collection', 'environment', 'piece_type', 'material', 'availability', 'price'])
const CATEGORY_AVAILABILITY = new Set(['unique', 'available', 'made_to_order', 'limited'])

function controlledStrings(value: unknown, allowed: Set<string>) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter((item): item is string => typeof item === 'string' && allowed.has(item))))
}

function categoryDraftData(input: Record<string, unknown> | undefined) {`,
    'admin category controlled constants',
  )
  source = replaceRequired(
    source,
    "  if (source.status === 'active' || source.status === 'archive') data.status = source.status\n  if (typeof source.order === 'number' && Number.isInteger(source.order) && source.order >= 0) data.order = source.order\n  if (source.parent === null || relationID(source.parent) !== null) data.parent = relationID(source.parent)\n  if (source.image === null || relationID(source.image) !== null) data.image = relationID(source.image)\n\n  if (Array.isArray(source.searchTerms)) {",
    `  if (source.status === 'active' || source.status === 'archive') data.status = source.status
  if (typeof source.order === 'number' && Number.isInteger(source.order) && source.order >= 0) data.order = source.order
  if (source.parent === null || relationID(source.parent) !== null) data.parent = relationID(source.parent)
  if (source.image === null || relationID(source.image) !== null) data.image = relationID(source.image)
  if (typeof source.nodeType === 'string' && CATEGORY_NODE_TYPES.has(source.nodeType)) data.nodeType = source.nodeType
  if (typeof source.taxonomyAxis === 'string' && CATEGORY_AXES.has(source.taxonomyAxis)) data.taxonomyAxis = source.taxonomyAxis
  if (typeof source.listingMode === 'string' && CATEGORY_LISTING_MODES.has(source.listingMode)) data.listingMode = source.listingMode
  if (typeof source.externalURL === 'string' || source.externalURL === null) data.externalURL = source.externalURL
  if (typeof source.hubPath === 'string' || source.hubPath === null) data.hubPath = source.hubPath

  if (source.menu && typeof source.menu === 'object') {
    const menuSource = source.menu as Record<string, unknown>
    const menu: Record<string, unknown> = {}
    if (typeof menuSource.showInMenu === 'boolean') menu.showInMenu = menuSource.showInMenu
    if (typeof menuSource.label === 'string' || menuSource.label === null) menu.label = menuSource.label
    if (menuSource.visibility === 'all' || menuSource.visibility === 'desktop' || menuSource.visibility === 'mobile') menu.visibility = menuSource.visibility
    if (typeof menuSource.icon === 'string' || menuSource.icon === null) menu.icon = menuSource.icon
    data.menu = menu
  }

  if (source.listingRules && typeof source.listingRules === 'object') {
    const rulesSource = source.listingRules as Record<string, unknown>
    const rules: Record<string, unknown> = {
      availability: controlledStrings(rulesSource.availability, CATEGORY_AVAILABILITY),
      productStatus: controlledStrings(rulesSource.productStatus, new Set(['active', 'archived'])),
    }
    if (Array.isArray(rulesSource.materials)) {
      rules.materials = rulesSource.materials
        .map((item) => item && typeof item === 'object' && 'value' in item ? String((item as { value?: unknown }).value || '').trim() : '')
        .filter(Boolean)
        .slice(0, 20)
        .map((value) => ({ value }))
    }
    for (const field of ['minPrice', 'maxPrice'] as const) {
      if (typeof rulesSource[field] === 'number' && Number.isFinite(rulesSource[field]) && rulesSource[field] >= 0) rules[field] = rulesSource[field]
    }
    for (const field of ['publishedAfter', 'publishedBefore'] as const) {
      if (typeof rulesSource[field] === 'string' || rulesSource[field] === null) rules[field] = rulesSource[field]
    }
    if (typeof rulesSource.sort === 'string' && CATEGORY_SORTS.has(rulesSource.sort)) rules.sort = rulesSource.sort
    data.listingRules = rules
  }

  if (source.collectionPage && typeof source.collectionPage === 'object') {
    const pageSource = source.collectionPage as Record<string, unknown>
    const page: Record<string, unknown> = {
      visibleFilters: controlledStrings(pageSource.visibleFilters, CATEGORY_FILTERS),
    }
    for (const field of ['eyebrow', 'shortDescription'] as const) {
      if (typeof pageSource[field] === 'string' || pageSource[field] === null) page[field] = pageSource[field]
    }
    if (typeof pageSource.defaultSort === 'string' && CATEGORY_SORTS.has(pageSource.defaultSort)) page.defaultSort = pageSource.defaultSort
    if (typeof pageSource.productsPerPage === 'number' && Number.isInteger(pageSource.productsPerPage) && pageSource.productsPerPage >= 1 && pageSource.productsPerPage <= 48) page.productsPerPage = pageSource.productsPerPage
    if (typeof pageSource.showProductCount === 'boolean') page.showProductCount = pageSource.showProductCount
    if (pageSource.layout === 'grid' || pageSource.layout === 'editorial') page.layout = pageSource.layout
    data.collectionPage = page
  }

  if (Array.isArray(source.searchTerms)) {`,
    'admin category taxonomy sanitization',
  )
  return source
})

edit('src/admin/modules/categories/CategoryDetailEditor.tsx', (source) => {
  source = replaceRequired(
    source,
    "  const [noIndex, setNoIndex] = useState(Boolean(category.seo?.noIndex))\n",
    `  const [noIndex, setNoIndex] = useState(Boolean(category.seo?.noIndex))
  const [nodeType, setNodeType] = useState(category.nodeType || 'collection')
  const [taxonomyAxis, setTaxonomyAxis] = useState(category.taxonomyAxis || 'navigation')
  const [showInMenu, setShowInMenu] = useState(Boolean(category.menu?.showInMenu))
  const [menuLabel, setMenuLabel] = useState(category.menu?.label || '')
  const [menuVisibility, setMenuVisibility] = useState(category.menu?.visibility || 'all')
  const [listingMode, setListingMode] = useState(category.listingMode || 'assigned')
  const [ruleAvailability, setRuleAvailability] = useState<string[]>(category.listingRules?.availability || [])
  const [defaultSort, setDefaultSort] = useState(category.collectionPage?.defaultSort || 'editorial')
  const [productsPerPage, setProductsPerPage] = useState(String(category.collectionPage?.productsPerPage ?? 24))
  const [visibleFilters, setVisibleFilters] = useState<string[]>(category.collectionPage?.visibleFilters || ['category', 'material', 'availability', 'price'])
  const [showProductCount, setShowProductCount] = useState(category.collectionPage?.showProductCount !== false)
  const [collectionLayout, setCollectionLayout] = useState(category.collectionPage?.layout || 'grid')
  const [externalURL, setExternalURL] = useState(category.externalURL || '')
  const [hubPath, setHubPath] = useState(category.hubPath || '')
`,
    'category editor taxonomy state',
  )
  source = replaceRequired(
    source,
    "    const parsedOrder = Number(order)\n    return {\n      title: title.trim(),\n      slug: slug.trim(),\n      description,\n      status,\n      order: Number.isInteger(parsedOrder) && parsedOrder >= 0 ? parsedOrder : 100,",
    `    const parsedOrder = Number(order)
    const parsedProductsPerPage = Number(productsPerPage)
    return {
      title: title.trim(),
      slug: slug.trim(),
      description,
      status,
      nodeType,
      taxonomyAxis,
      menu: { showInMenu, label: menuLabel.trim(), visibility: menuVisibility },
      listingMode,
      listingRules: {
        availability: ruleAvailability,
        productStatus: ['active'],
        sort: defaultSort,
      },
      collectionPage: {
        visibleFilters,
        defaultSort,
        productsPerPage: Number.isInteger(parsedProductsPerPage) && parsedProductsPerPage >= 1 && parsedProductsPerPage <= 48 ? parsedProductsPerPage : 24,
        showProductCount,
        layout: collectionLayout,
      },
      externalURL: externalURL.trim() || null,
      hubPath: hubPath.trim() || null,
      order: Number.isInteger(parsedOrder) && parsedOrder >= 0 ? parsedOrder : 100,`,
    'category editor visible taxonomy data',
  )
  source = replaceRequired(
    source,
    `            <div className="esmera-category-advanced__body">
              <FieldV2 id="category-order" path="order" label="Ordem editorial" hint="Normalmente controlada pela reordenação da lista." error={errorFor('order')}>
                {(control) => <input {...control} className="esmera-input" type="number" min="0" step="1" value={order} onChange={(event) => { setOrder(event.target.value); edited() }} />}
              </FieldV2>
            </div>`,
    `            <div className="esmera-category-advanced__body">
              <FieldV2 path="nodeType" label="Tipo do nó" error={errorFor('nodeType')}>
                {(control) => (
                  <select {...control} className="esmera-input" value={nodeType} onChange={(event) => { setNodeType(event.target.value as typeof nodeType); edited() }}>
                    <option value="collection">Coleção com produtos</option>
                    <option value="editorial">Página editorial</option>
                    <option value="external">Link externo</option>
                    <option value="group">Agrupador de navegação</option>
                  </select>
                )}
              </FieldV2>
              <FieldV2 path="taxonomyAxis" label="Eixo taxonômico" error={errorFor('taxonomyAxis')}>
                {(control) => (
                  <select {...control} className="esmera-input" value={taxonomyAxis} onChange={(event) => { setTaxonomyAxis(event.target.value as typeof taxonomyAxis); edited() }}>
                    <option value="navigation">Navegação</option>
                    <option value="piece_type">Tipo de peça</option>
                    <option value="collection">Coleção</option>
                    <option value="environment">Ambiente</option>
                    <option value="campaign">Campanha</option>
                    <option value="service">Serviço</option>
                  </select>
                )}
              </FieldV2>
              <label className="esmera-category-checkbox"><input type="checkbox" checked={showInMenu} onChange={(event) => { setShowInMenu(event.target.checked); edited() }} /> Exibir no menu</label>
              <FieldV2 path="menu.label" label="Rótulo no menu" optional error={errorFor('menu.label')}>
                {(control) => <input {...control} className="esmera-input" value={menuLabel} onChange={(event) => { setMenuLabel(event.target.value); edited() }} />}
              </FieldV2>
              <FieldV2 path="menu.visibility" label="Visibilidade no menu" error={errorFor('menu.visibility')}>
                {(control) => (
                  <select {...control} className="esmera-input" value={menuVisibility} onChange={(event) => { setMenuVisibility(event.target.value as typeof menuVisibility); edited() }}>
                    <option value="all">Desktop e mobile</option>
                    <option value="desktop">Somente desktop</option>
                    <option value="mobile">Somente mobile</option>
                  </select>
                )}
              </FieldV2>
              <FieldV2 path="listingMode" label="Modo de listagem" error={errorFor('listingMode')}>
                {(control) => (
                  <select {...control} className="esmera-input" value={listingMode} onChange={(event) => { setListingMode(event.target.value as typeof listingMode); edited() }}>
                    <option value="assigned">Produtos atribuídos</option>
                    <option value="descendants">Categoria e descendentes</option>
                    <option value="rules">Regras automáticas</option>
                    <option value="hybrid">Atribuídos + regras</option>
                  </select>
                )}
              </FieldV2>
              {(listingMode === 'rules' || listingMode === 'hybrid') ? (
                <fieldset className="esmera-category-options esmera-category-field--wide">
                  <legend>Disponibilidade usada pela regra</legend>
                  {[
                    ['available', 'Disponível'],
                    ['unique', 'Peça única'],
                    ['limited', 'Disponibilidade limitada'],
                    ['made_to_order', 'Sob encomenda'],
                  ].map(([value, label]) => (
                    <label key={value} className="esmera-category-checkbox">
                      <input type="checkbox" checked={ruleAvailability.includes(value)} onChange={(event) => { setRuleAvailability((current) => event.target.checked ? [...new Set([...current, value])] : current.filter((item) => item !== value)); edited() }} /> {label}
                    </label>
                  ))}
                </fieldset>
              ) : null}
              <FieldV2 path="collectionPage.defaultSort" label="Ordenação padrão" error={errorFor('collectionPage.defaultSort')}>
                {(control) => (
                  <select {...control} className="esmera-input" value={defaultSort} onChange={(event) => { setDefaultSort(event.target.value as typeof defaultSort); edited() }}>
                    <option value="editorial">Editorial</option>
                    <option value="newest">Mais recentes</option>
                    <option value="price_asc">Menor preço</option>
                    <option value="price_desc">Maior preço</option>
                    <option value="name_asc">Nome</option>
                  </select>
                )}
              </FieldV2>
              <FieldV2 path="collectionPage.productsPerPage" label="Produtos por página" hint="Use entre 1 e 48." error={errorFor('collectionPage.productsPerPage')}>
                {(control) => <input {...control} className="esmera-input" type="number" min="1" max="48" step="1" value={productsPerPage} onChange={(event) => { setProductsPerPage(event.target.value); edited() }} />}
              </FieldV2>
              <FieldV2 path="collectionPage.layout" label="Layout da coleção" error={errorFor('collectionPage.layout')}>
                {(control) => (
                  <select {...control} className="esmera-input" value={collectionLayout} onChange={(event) => { setCollectionLayout(event.target.value as typeof collectionLayout); edited() }}>
                    <option value="grid">Grade regular</option>
                    <option value="editorial">Grade com inserções editoriais</option>
                  </select>
                )}
              </FieldV2>
              <label className="esmera-category-checkbox"><input type="checkbox" checked={showProductCount} onChange={(event) => { setShowProductCount(event.target.checked); edited() }} /> Exibir contagem de produtos</label>
              <fieldset className="esmera-category-options esmera-category-field--wide">
                <legend>Filtros disponíveis na página</legend>
                {[
                  ['category', 'Categoria'], ['collection', 'Coleção'], ['environment', 'Ambiente'], ['piece_type', 'Tipo de peça'],
                  ['material', 'Material'], ['availability', 'Disponibilidade'], ['price', 'Preço'],
                ].map(([value, label]) => (
                  <label key={value} className="esmera-category-checkbox">
                    <input type="checkbox" checked={visibleFilters.includes(value)} onChange={(event) => { setVisibleFilters((current) => event.target.checked ? [...new Set([...current, value])] : current.filter((item) => item !== value)); edited() }} /> {label}
                  </label>
                ))}
              </fieldset>
              {nodeType === 'external' ? (
                <FieldV2 path="externalURL" label="URL externa" className="esmera-category-field--wide" error={errorFor('externalURL')}>
                  {(control) => <input {...control} className="esmera-input" type="url" value={externalURL} onChange={(event) => { setExternalURL(event.target.value); edited() }} />}
                </FieldV2>
              ) : null}
              {nodeType === 'group' ? (
                <FieldV2 path="hubPath" label="Rota opcional do agrupador" className="esmera-category-field--wide" error={errorFor('hubPath')}>
                  {(control) => <input {...control} className="esmera-input" placeholder="/colecao/pecas" value={hubPath} onChange={(event) => { setHubPath(event.target.value); edited() }} />}
                </FieldV2>
              ) : null}
              <FieldV2 id="category-order" path="order" label="Ordem editorial" hint="Normalmente controlada pela reordenação da lista." error={errorFor('order')}>
                {(control) => <input {...control} className="esmera-input" type="number" min="0" step="1" value={order} onChange={(event) => { setOrder(event.target.value); edited() }} />}
              </FieldV2>
            </div>`,
    'category editor advanced taxonomy controls',
  )
  source = replaceRequired(
    source,
    "          <FieldV2 id=\"category-seo\" path=\"seo\" label=\"Título SEO\" optional error={errorFor('seo')}">",
    `          <div className="esmera-category-editorial-callout esmera-category-field--wide">
            <div>
              <strong>Conteúdo editorial e destaques do mega menu</strong>
              <p>Os blocos são controlados pelo schema e permanecem nesta aba. Use o editor técnico para montar galerias, texto com imagem, manifestos, CTAs e destaques.</p>
            </div>
            <a className="esmera-button esmera-button--quiet" href={\`/admin/collections/categories/${'${category.id}'}\`}>Editar blocos</a>
          </div>

          <FieldV2 id="category-seo" path="seo" label="Título SEO" optional error={errorFor('seo')}>`,
    'category editor controlled block callout',
  )
  return source
})

edit('src/admin/modules/categories/CategoriesView.tsx', (source) => replaceRequired(
  source,
  "          status: true,\n          order: true,\n          parent: true,",
  "          status: true,\n          nodeType: true,\n          taxonomyAxis: true,\n          order: true,\n          parent: true,",
  'category list taxonomy selects',
))

edit('src/admin/modules/categories/categories.scss', (source) => {
  if (source.includes('.esmera-category-options')) return source
  return `${source.trimEnd()}

.esmera-category-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--esmera-space-3);
  margin: 0;
  padding: var(--esmera-space-4);
  border: 1px solid var(--esmera-border-subtle);
}

.esmera-category-options legend {
  padding-inline: var(--esmera-space-2);
  font-size: var(--esmera-text-sm);
  font-weight: 600;
}

.esmera-category-editorial-callout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--esmera-space-4);
  padding: var(--esmera-space-4);
  border: 1px solid var(--esmera-border-subtle);
  background: var(--esmera-surface-soft);
}

.esmera-category-editorial-callout p {
  margin: var(--esmera-space-1) 0 0;
  color: var(--esmera-text-muted);
}

@media (max-width: 720px) {
  .esmera-category-editorial-callout {
    align-items: stretch;
    flex-direction: column;
  }
}
`
})

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
