/* eslint-disable react-hooks/error-boundaries -- Query failures are handled here; render failures remain handled by the Next.js/Payload boundaries. */
import type { AdminViewServerProps, Where } from 'payload'
import {
  AccessDenied,
  countDocs,
  EmptyState,
  ensureUser,
  findDocs,
  hrefWithParams,
  MasterDetailLayout,
  money,
  PageHeader,
  Pagination,
  paramValue,
  positiveInt,
  QueryError,
  resolveSearchParams,
  shortDate,
  StatusBadge,
  TechnicalLink,
  ViewFrame,
} from './shared'

type Relation = string | number | { id?: string | number; title?: string | null; name?: string | null; alt?: string | null; url?: string | null; sizes?: Record<string, { url?: string | null }> | null }

type GalleryItem = {
  image?: Relation
  role?: string | null
  altOverride?: string | null
  alt?: string | null
}

type Product = {
  id: string | number
  title?: string | null
  subtitle?: string | null
  code?: string | null
  catalogStatus?: string | null
  availability?: string | null
  material?: string | null
  priceMode?: string | null
  basePriceCents?: number | null
  _status?: string | null
  categories?: Relation[] | null
  gallery?: GalleryItem[] | null
  variants?: unknown[] | null
  updatedAt?: string
}

type Category = {
  id: string | number
  title?: string | null
  slug?: string | null
  status?: string | null
  order?: number | null
  description?: string | null
  parent?: Relation | null
  image?: Relation | null
  _status?: string | null
  updatedAt?: string
}

type GlobalSummary = {
  _status?: string | null
  updatedAt?: string | null
}

const availabilityLabels: Record<string, string> = {
  unique: 'Peça única',
  available: 'Disponível',
  made_to_order: 'Sob encomenda',
  limited: 'Edição limitada',
}

function relationLabel(value: Relation | null | undefined) {
  if (!value || typeof value !== 'object') return '—'
  return value.title || value.name || '—'
}

function mediaUrl(value: Relation | null | undefined) {
  if (!value || typeof value !== 'object') return null
  return value.sizes?.thumbnail?.url || value.sizes?.card?.url || value.url || null
}

function productReadiness(product: Product | null) {
  if (!product) return []
  const issues: string[] = []
  if (!product.title) issues.push('título')
  if (!product.code) issues.push('código')
  if (product.catalogStatus === 'active' && !product.categories?.length) issues.push('categoria')
  if (product.catalogStatus === 'active' && !product.gallery?.length) issues.push('imagem')
  if (product.gallery?.length && product.gallery.filter((item) => item.role === 'cover').length !== 1) issues.push('capa')
  if (product.priceMode === 'fixed' && typeof product.basePriceCents !== 'number') {
    const hasVariantPrice = Array.isArray(product.variants) && product.variants.length > 0
    if (!hasVariantPrice) issues.push('preço')
  }
  return issues
}

function ProductThumb({ product }: { product: Product }) {
  const cover = product.gallery?.find((item) => item.role === 'cover') || product.gallery?.[0]
  const src = mediaUrl(cover?.image)
  if (!src) return <span className="esmera-thumb esmera-thumb--empty" aria-hidden="true" />
  const alt = cover?.altOverride || cover?.alt || (cover?.image && typeof cover.image === 'object' ? cover.image.alt : '') || ''
  return <img className="esmera-thumb" src={src} alt={alt} loading="lazy" />
}

export async function ContentView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'site')
  if (!allowed) return <AccessDenied props={props} area="editorial" />
  try {
    const req = props.initPageResult.req
    const definitions = [
      { title: 'Home', copy: 'Hero, manifesto, seleção, Matter e Signature', slug: 'home', href: '/admin/globals/home' },
      { title: 'Sobre', copy: 'Maison, visão, matéria e proveniência', slug: 'about', href: '/admin/globals/about' },
      { title: 'Contato', copy: 'Canais, atendimento e CTA', slug: 'contact', href: '/admin/globals/contact' },
      { title: 'Coleção', copy: 'Introdução, filtros e estado vazio', slug: 'collection-page', href: '/admin/globals/collection-page' },
      { title: 'Navegação', copy: 'Menu universal e destinos do site', slug: 'navigation', href: '/admin/globals/navigation' },
      { title: 'Configurações', copy: 'Canais oficiais e defaults do site', slug: 'site-settings', href: '/admin/globals/site-settings' },
    ] as const

    const [drafts, globalStates] = await Promise.all([
      findDocs<Product>(req, 'products', {
        where: { _status: { equals: 'draft' } } as Where,
        sort: '-updatedAt',
        limit: 25,
        depth: 1,
        draft: true,
        select: { id: true, title: true, code: true, categories: true, gallery: true, updatedAt: true },
      }),
      Promise.all(definitions.map(async (definition) => {
        const [latest, published] = await Promise.all([
          req.payload.findGlobal({ slug: definition.slug as never, draft: true, depth: 0, overrideAccess: false, req }),
          req.payload.findGlobal({ slug: definition.slug as never, draft: false, depth: 0, overrideAccess: false, req }),
        ])
        const latestSummary = latest as GlobalSummary
        const publishedSummary = published as GlobalSummary
        const status = latestSummary._status === 'published'
          ? 'Publicado'
          : publishedSummary?.updatedAt && latestSummary.updatedAt !== publishedSummary.updatedAt
            ? 'Alterado'
            : 'Rascunho'
        return { ...definition, status, updatedAt: latestSummary.updatedAt }
      })),
    ])

    const qualityIssues = drafts.docs.filter((product) => productReadiness(product).length)

    return (
      <ViewFrame props={props}>
        <PageHeader eyebrow="Site" title="Conteúdo do site" subtitle="Saúde editorial e acesso às áreas do site. Edição, publicação e histórico continuam no fluxo oficial do Payload." />
        <section className="esmera-card">
          <div className="esmera-card-header"><h2>Status editorial</h2><span className="esmera-pill">6 áreas</span></div>
          <div className="esmera-content-grid">
            {globalStates.map((page) => (
              <article className="esmera-content-row" key={page.href}>
                <div><strong>{page.title}</strong><span>{page.copy}</span></div>
                <div className="esmera-content-row-actions">
                  <StatusBadge tone={page.status === 'Publicado' ? 'green' : page.status === 'Alterado' ? 'sand' : 'neutral'}>{page.status}</StatusBadge>
                  <small>{shortDate(page.updatedAt)}</small>
                  <TechnicalLink href={page.href}>Editar</TechnicalLink>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="esmera-card" style={{ marginTop: 16 }}>
          <div className="esmera-card-header"><h2>Pendências editoriais recentes</h2><StatusBadge tone={qualityIssues.length ? 'sand' : 'green'}>{qualityIssues.length} pendências</StatusBadge></div>
          <div className="esmera-card-body">
            {qualityIssues.length ? <div className="esmera-quality-list">{qualityIssues.slice(0, 8).map((product) => <div className="esmera-quality-item" key={String(product.id)}><div><strong>{product.title || 'Produto sem título'}</strong><div className="esmera-row-meta">{productReadiness(product).map((issue) => `sem ${issue}`).join(' · ')}</div></div><TechnicalLink href={`/admin/collections/products/${product.id}`}>Corrigir</TechnicalLink></div>)}</div> : <p className="esmera-card-copy">Nenhuma pendência foi encontrada entre os rascunhos recentes consultados.</p>}
          </div>
        </section>
      </ViewFrame>
    )
  } catch (error) {
    return <ViewFrame props={props}><PageHeader title="Conteúdo do site" subtitle="Editorial" /><QueryError title="Não foi possível consultar o conteúdo" error={error} /></ViewFrame>
  }
}

export async function ProductsView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'site')
  if (!allowed) return <AccessDenied props={props} area="editorial" />
  try {
    const req = props.initPageResult.req
    const params = await resolveSearchParams(props)
    const q = paramValue(params, 'q').trim()
    const catalogStatus = paramValue(params, 'catalogStatus')
    const availability = paramValue(params, 'availability')
    const publication = paramValue(params, 'publication')
    const category = paramValue(params, 'category')
    const requestedSort = paramValue(params, 'sort', '-updatedAt')
    const sort = ['-updatedAt', 'title', 'code', 'availability'].includes(requestedSort) ? requestedSort : '-updatedAt'
    const page = positiveInt(paramValue(params, 'page'), 1)

    const conditions: Where[] = []
    if (q) conditions.push({ or: [{ title: { contains: q } }, { subtitle: { contains: q } }, { code: { contains: q } }, { material: { contains: q } }] } as Where)
    if (catalogStatus) conditions.push({ catalogStatus: { equals: catalogStatus } } as Where)
    if (availability) conditions.push({ availability: { equals: availability } } as Where)
    if (publication) conditions.push({ _status: { equals: publication } } as Where)
    if (category) conditions.push({ categories: { in: [category] } } as Where)
    const where = conditions.length ? ({ and: conditions } as Where) : undefined

    const [result, categoryOptions] = await Promise.all([
      findDocs<Product>(req, 'products', {
        where,
        sort,
        limit: 25,
        page,
        depth: 1,
        draft: true,
        select: { id: true, title: true, code: true, catalogStatus: true, availability: true, _status: true, gallery: true, updatedAt: true },
      }),
      findDocs<Category>(req, 'categories', { sort: 'order', limit: 100, depth: 0, select: { id: true, title: true } }),
    ])

    const selectedId = paramValue(params, 'selected') || (result.docs[0] ? String(result.docs[0].id) : '')
    const selected = selectedId
      ? (await req.payload.findByID({ collection: 'products', id: selectedId, depth: 2, draft: true, overrideAccess: false, req })) as Product
      : null
    const issues = productReadiness(selected)

    return <ViewFrame props={props}>
      <PageHeader eyebrow="Catálogo" title="Produtos" subtitle="Localize, avalie e aja sobre o catálogo sem recriar o editor técnico do Payload." actions={<TechnicalLink href="/admin/collections/products/create" primary>Novo produto</TechnicalLink>} />

      <div className="esmera-toolbar">
        <form action="/admin/products" method="get">
          <input className="esmera-input" name="q" defaultValue={q} placeholder="Buscar título, código ou material" aria-label="Buscar produtos" />
          <select className="esmera-select" name="catalogStatus" defaultValue={catalogStatus} aria-label="Status do catálogo"><option value="">Todos os status</option><option value="active">Ativos</option><option value="archive">Arquivados</option></select>
          <select className="esmera-select" name="publication" defaultValue={publication} aria-label="Publicação"><option value="">Publicação</option><option value="published">Publicados</option><option value="draft">Rascunhos</option></select>
          <select className="esmera-select" name="availability" defaultValue={availability} aria-label="Disponibilidade"><option value="">Disponibilidade</option><option value="unique">Peça única</option><option value="available">Disponível</option><option value="made_to_order">Sob encomenda</option><option value="limited">Edição limitada</option></select>
          <select className="esmera-select" name="category" defaultValue={category} aria-label="Categoria"><option value="">Categoria</option>{categoryOptions.docs.map((item) => <option value={String(item.id)} key={String(item.id)}>{item.title || 'Sem título'}</option>)}</select>
          <select className="esmera-select" name="sort" defaultValue={sort} aria-label="Ordenação"><option value="-updatedAt">Atualizados recentemente</option><option value="title">Título A–Z</option><option value="code">Código</option><option value="availability">Disponibilidade</option></select>
          <button className="esmera-button" type="submit">Aplicar</button>
        </form>
        <a className="esmera-toolbar-reset" href="/admin/products">Limpar</a>
      </div>

      <MasterDetailLayout
        master={<>
          <div className="esmera-master-head"><span>{result.totalDocs} produto{result.totalDocs === 1 ? '' : 's'}</span><span>{q ? `Busca: ${q}` : 'Catálogo'}</span></div>
          {result.docs.length ? <ul className="esmera-master-list">{result.docs.map((product) => <li key={String(product.id)}><a className={`esmera-master-row esmera-master-row--thumb${String(product.id) === selectedId ? ' is-selected' : ''}`} href={hrefWithParams('/admin/products', params, { selected: product.id, page: result.page })}><ProductThumb product={product} /><div><strong>{product.title || 'Produto sem título'}</strong><small>{product.code || 'Sem código'} · {availabilityLabels[product.availability || ''] || 'Disponibilidade não definida'} · {shortDate(product.updatedAt)}</small></div><div className="esmera-master-row-meta"><StatusBadge tone={product.catalogStatus === 'active' ? 'green' : 'neutral'}>{product.catalogStatus === 'active' ? 'Ativo' : 'Arquivado'}</StatusBadge></div></a></li>)}</ul> : <EmptyState title="Nenhum produto encontrado" copy={q || conditions.length ? 'A consulta foi concluída, mas nenhum registro corresponde aos filtros.' : 'Crie o primeiro produto para iniciar o catálogo.'} />}
          <Pagination path="/admin/products" params={params} page={result.page} totalPages={result.totalPages} totalDocs={result.totalDocs} />
        </>}
        detail={selected ? <div className="esmera-detail-inner">
          <span className="esmera-detail-kicker">{selected.code || 'Sem código'}</span>
          <h2 className="esmera-detail-title">{selected.title || 'Produto sem título'}</h2>
          <p className="esmera-detail-subtitle">{selected.subtitle || 'Sem subtítulo editorial.'}</p>
          <div className="esmera-detail-actions"><TechnicalLink href={`/admin/collections/products/${selected.id}`} primary>Editar produto</TechnicalLink><StatusBadge tone={issues.length ? 'sand' : 'green'}>{issues.length ? `${issues.length} pendência${issues.length === 1 ? '' : 's'}` : 'Pronto para publicar'}</StatusBadge></div>
          <div className="esmera-detail-grid">
            <div className="esmera-detail-field"><span>Publicação</span><strong>{selected._status === 'published' ? 'Publicado' : 'Rascunho'}</strong></div>
            <div className="esmera-detail-field"><span>Catálogo</span><strong>{selected.catalogStatus === 'active' ? 'Ativo' : 'Arquivado'}</strong></div>
            <div className="esmera-detail-field"><span>Disponibilidade</span><strong>{availabilityLabels[selected.availability || ''] || '—'}</strong></div>
            <div className="esmera-detail-field"><span>Preço</span><strong>{selected.priceMode === 'fixed' ? money(selected.basePriceCents) : 'Sob consulta'}</strong></div>
            <div className="esmera-detail-field"><span>Material</span><strong>{selected.material || '—'}</strong></div>
            <div className="esmera-detail-field"><span>Atualizado</span><strong>{shortDate(selected.updatedAt)}</strong></div>
            <div className="esmera-detail-field"><span>Categorias</span><strong>{selected.categories?.map((item) => relationLabel(item)).filter((value) => value !== '—').join(', ') || '—'}</strong></div>
            <div className="esmera-detail-field"><span>Variantes</span><strong>{selected.variants?.length || 0}</strong></div>
          </div>
          {issues.length ? <div className="esmera-detail-section"><h3>Readiness</h3><div className="esmera-state esmera-state--warning"><strong>Antes de publicar</strong><p>Complete: {issues.join(', ')}.</p></div></div> : null}
        </div> : <EmptyState title="Selecione um produto" copy="O contexto do produto aparece aqui sem duplicar o formulário completo." />}
      />
    </ViewFrame>
  } catch (error) { return <ViewFrame props={props}><PageHeader title="Produtos" subtitle="Catálogo" /><QueryError title="Não foi possível consultar produtos" error={error} /></ViewFrame> }
}

export async function CategoriesView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'site')
  if (!allowed) return <AccessDenied props={props} area="editorial" />
  try {
    const req = props.initPageResult.req
    const params = await resolveSearchParams(props)
    const q = paramValue(params, 'q').trim()
    const status = paramValue(params, 'status')
    const page = positiveInt(paramValue(params, 'page'), 1)
    const conditions: Where[] = []
    if (q) conditions.push({ or: [{ title: { contains: q } }, { slug: { contains: q } }] } as Where)
    if (status) conditions.push({ status: { equals: status } } as Where)
    const where = conditions.length ? ({ and: conditions } as Where) : undefined

    const result = await findDocs<Category>(req, 'categories', {
      where,
      sort: 'order',
      limit: 25,
      page,
      depth: 1,
      draft: true,
      select: { id: true, title: true, slug: true, status: true, order: true, parent: true, image: true, _status: true, updatedAt: true },
    })
    const selectedId = paramValue(params, 'selected') || (result.docs[0] ? String(result.docs[0].id) : '')
    const selected = selectedId
      ? (await req.payload.findByID({ collection: 'categories', id: selectedId, depth: 2, draft: true, overrideAccess: false, req })) as Category
      : null
    const productCount = selected ? await countDocs(req, 'products', { categories: { in: [selected.id] } } as Where) : 0

    return <ViewFrame props={props}>
      <PageHeader eyebrow="Catálogo" title="Categorias" subtitle="Taxonomia com contexto, hierarquia validada e edição profunda mantida no Payload nativo." actions={<TechnicalLink href="/admin/collections/categories/create" primary>Nova categoria</TechnicalLink>} />
      <div className="esmera-toolbar"><form action="/admin/categories" method="get"><input className="esmera-input" name="q" defaultValue={q} placeholder="Buscar nome ou slug" aria-label="Buscar categorias" /><select className="esmera-select" name="status" defaultValue={status} aria-label="Status"><option value="">Todos os status</option><option value="active">Ativas</option><option value="archive">Arquivadas</option></select><button className="esmera-button" type="submit">Aplicar</button></form><a className="esmera-toolbar-reset" href="/admin/categories">Limpar</a></div>
      <MasterDetailLayout
        master={<><div className="esmera-master-head"><span>{result.totalDocs} categoria{result.totalDocs === 1 ? '' : 's'}</span><span>Ordem editorial</span></div>{result.docs.length ? <ul className="esmera-master-list">{result.docs.map((item) => <li key={String(item.id)}><a className={`esmera-master-row${String(item.id) === selectedId ? ' is-selected' : ''}`} href={hrefWithParams('/admin/categories', params, { selected: item.id, page: result.page })}><div><strong>{item.title || 'Categoria sem título'}</strong><small>/{item.slug || 'sem-slug'} · ordem {item.order ?? '—'} · {relationLabel(item.parent) !== '—' ? `filha de ${relationLabel(item.parent)}` : 'raiz'}</small></div><StatusBadge tone={item.status === 'active' ? 'green' : 'neutral'}>{item.status === 'active' ? 'Ativa' : 'Arquivada'}</StatusBadge></a></li>)}</ul> : <EmptyState title="Nenhuma categoria encontrada" copy={q || status ? 'Nenhuma categoria corresponde aos filtros.' : 'Crie categorias antes de publicar produtos ativos.'} />}<Pagination path="/admin/categories" params={params} page={result.page} totalPages={result.totalPages} totalDocs={result.totalDocs} /></>}
        detail={selected ? <div className="esmera-detail-inner"><span className="esmera-detail-kicker">/{selected.slug || 'sem-slug'}</span><h2 className="esmera-detail-title">{selected.title || 'Categoria sem título'}</h2><p className="esmera-detail-subtitle">{selected.description || 'Sem descrição editorial.'}</p><div className="esmera-detail-actions"><TechnicalLink href={`/admin/collections/categories/${selected.id}`} primary>Editar categoria</TechnicalLink><StatusBadge tone={selected.status === 'active' ? 'green' : 'neutral'}>{selected.status === 'active' ? 'Ativa' : 'Arquivada'}</StatusBadge></div><div className="esmera-detail-grid"><div className="esmera-detail-field"><span>Publicação</span><strong>{selected._status === 'published' ? 'Publicado' : 'Rascunho'}</strong></div><div className="esmera-detail-field"><span>Categoria principal</span><strong>{relationLabel(selected.parent)}</strong></div><div className="esmera-detail-field"><span>Ordem</span><strong>{selected.order ?? '—'}</strong></div><div className="esmera-detail-field"><span>Produtos relacionados</span><strong>{productCount}</strong></div><div className="esmera-detail-field"><span>Atualizado</span><strong>{shortDate(selected.updatedAt)}</strong></div></div></div> : <EmptyState title="Selecione uma categoria" copy="O painel contextual aparece aqui." />}
      />
    </ViewFrame>
  } catch (error) { return <ViewFrame props={props}><PageHeader title="Categorias" subtitle="Catálogo" /><QueryError title="Não foi possível consultar categorias" error={error} /></ViewFrame> }
}

export async function SettingsView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'site')
  if (!allowed) return <AccessDenied props={props} area="editorial" />
  return <ViewFrame props={props}>
    <PageHeader eyebrow="Site" title="Configurações" subtitle="Atalhos seguros para configuração editorial. Status de infraestrutura não é presumido pela interface." />
    <div className="esmera-grid-equal">
      <section className="esmera-card"><div className="esmera-card-body"><h2>Configurações do site</h2><p className="esmera-card-copy">Canais oficiais, URL do frontend e defaults editoriais.</p><TechnicalLink href="/admin/globals/site-settings">Abrir configurações</TechnicalLink></div></section>
      <section className="esmera-card"><div className="esmera-card-body"><h2>Navegação</h2><p className="esmera-card-copy">Links principais, categorias do submenu e utilitários.</p><TechnicalLink href="/admin/globals/navigation">Editar navegação</TechnicalLink></div></section>
    </div>
    <div className="esmera-state esmera-state--warning"><strong>Infraestrutura</strong><p>Banco, storage, CORS, backups e credenciais são verificados fora desta UI. O painel não exibe selos de segurança sem health check real.</p></div>
  </ViewFrame>
}

export async function TechnicalView(props: AdminViewServerProps) {
  const { user, role } = ensureUser(props)
  const site = role === 'admin' || role === 'editor'
  const business = role === 'admin' || role === 'commercial'

  if (!user || !role) return <AccessDenied props={props} area="técnica" />

  const siteEntries = [
    ['Produtos', '/admin/collections/products', 'Campos completos, drafts, versões e histórico do catálogo.'],
    ['Categorias', '/admin/collections/categories', 'Taxonomia, hierarquia, SEO e publicação.'],
    ['Mídia', '/admin/collections/media', 'Biblioteca de imagens e metadados acessíveis.'],
    ['Home', '/admin/globals/home', 'Hero, manifesto, seleção, Matter, Signature e proveniência.'],
    ['Sobre', '/admin/globals/about', 'Conteúdo institucional e SEO.'],
    ['Contato', '/admin/globals/contact', 'Canais, atendimento e CTA.'],
    ['Coleção', '/admin/globals/collection-page', 'Filtros, textos e estado vazio.'],
    ['Navegação', '/admin/globals/navigation', 'Menu principal e links utilitários.'],
    ['Configurações do site', '/admin/globals/site-settings', 'Canais oficiais e parâmetros editoriais.'],
  ]

  const businessEntries = [
    ['Leads', '/admin/collections/leads', 'Pipeline, interesses, consentimento e próxima ação.'],
    ['Clientes', '/admin/collections/customers', 'Contato, preferências, relacionamento e privacidade.'],
    ['Vendas', '/admin/collections/sales', 'Itens, snapshots, valores, status e entrega.'],
    ['Pós-venda', '/admin/collections/after-sales', 'Follow-ups, monitoramento e ocorrências.'],
    ['Tarefas', '/admin/collections/tasks', 'Pendências operacionais vinculadas aos registros.'],
    ['Atividades', '/admin/collections/activities', 'Linha do tempo de contatos, mensagens, propostas e mudanças.'],
  ]

  const renderEntries = (entries: string[][]) => <div className="esmera-grid-3">{entries.map(([title, href, copy]) => <section className="esmera-card" key={href}><div className="esmera-card-body"><span className="esmera-eyebrow">Admin técnico</span><h2 style={{ marginTop: 8 }}>{title}</h2><p className="esmera-card-copy">{copy}</p><TechnicalLink href={href}>Abrir</TechnicalLink></div></section>)}</div>

  return <ViewFrame props={props}>
    <PageHeader eyebrow="Sistema" title="Admin técnico" subtitle="CRUD completo, drafts, versões e operações avançadas do Payload — a mesma fonte de dados do portal operacional." />
    <div className="esmera-state"><strong>Uma única verdade</strong><p>O portal operacional organiza tarefas frequentes. Esta área expõe profundidade técnica sem criar outro schema ou outra regra de publicação.</p></div>
    {site ? <><h2 style={{ marginTop: 30 }}>Site e catálogo</h2>{renderEntries(siteEntries)}</> : null}
    {business ? <><h2 style={{ marginTop: 30 }}>Business</h2>{renderEntries(businessEntries)}</> : null}
    {role === 'admin' ? <><h2 style={{ marginTop: 30 }}>Sistema</h2>{renderEntries([['Usuários', '/admin/collections/users', 'Acesso, autenticação e papéis de usuário.']])}</> : null}
  </ViewFrame>
}
