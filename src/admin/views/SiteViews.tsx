/* eslint-disable react-hooks/error-boundaries -- Query failures are handled here; render failures remain handled by the Next.js/Payload boundaries. */
import type { AdminViewServerProps, Where } from 'payload'
import {
  AccessDenied,
  EmptyState,
  ensureUser,
  findDocs,
  PageHeader,
  QueryError,
  shortDate,
  TechnicalLink,
  ViewFrame,
} from './shared'

type Product = {
  id: string | number
  title?: string | null
  code?: string | null
  catalogStatus?: string | null
  availability?: string | null
  _status?: string | null
  categories?: unknown[] | null
  gallery?: unknown[] | null
  publicationReady?: boolean | null
  publicationIssues?: Array<{ message?: string | null }> | null
  updatedAt?: string
}

type Category = {
  id: string | number
  title?: string | null
  slug?: string | null
  status?: string | null
  order?: number | null
  updatedAt?: string
}

export async function ContentView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'site')
  if (!allowed) return <AccessDenied props={props} area="editorial" />
  try {
    const req = props.initPageResult.req
    const drafts = await findDocs<Product>(req, 'products', {
      where: { _status: { equals: 'draft' } } as Where,
      limit: 200,
      depth: 0,
      draft: true,
      select: {
        id: true,
        title: true,
        code: true,
        categories: true,
        gallery: true,
        publicationReady: true,
        publicationIssues: true,
      },
    })
    const qualityIssues = drafts.docs.filter((product) => product.publicationReady !== true)
    const pages = [
      ['Home', 'Hero, manifesto, seleção, Matter e Signature', '/admin/globals/home'],
      ['Sobre', 'Maison, visão, matéria e proveniência', '/admin/globals/about'],
      ['Contato', 'Canais, atendimento e CTA', '/admin/globals/contact'],
      ['Coleção', 'Introdução, filtros e estado vazio', '/admin/globals/collection-page'],
      ['Navegação', 'Menu desktop e mobile', '/admin/globals/navigation'],
      ['Configurações', 'Canais oficiais e defaults do site', '/admin/globals/site-settings'],
    ]
    return (
      <ViewFrame props={props}>
        <PageHeader eyebrow="Site" title="Conteúdo do site" subtitle="Acesso curado às áreas editoriais. Publicação e histórico continuam no editor técnico." />
        <div className="esmera-grid-3">
          {pages.map(([title, copy, href]) => <section className="esmera-card" key={href}><div className="esmera-card-body"><span className="esmera-eyebrow">Conteúdo</span><h2 style={{ marginTop: 8 }}>{title}</h2><p className="esmera-card-copy">{copy}</p><TechnicalLink href={href}>Editar no Admin técnico</TechnicalLink></div></section>)}
        </div>
        <section className="esmera-card">
          <div className="esmera-card-header"><h2>Qualidade editorial</h2><span className={`esmera-pill ${qualityIssues.length ? 'esmera-pill--sand' : 'esmera-pill--green'}`}>{qualityIssues.length} pendências</span></div>
          <div className="esmera-card-body">
            {qualityIssues.length ? <div className="esmera-quality-list">{qualityIssues.slice(0, 8).map((product) => <div className="esmera-quality-item" key={String(product.id)}><div><strong>{product.title || 'Produto sem título'}</strong><div className="esmera-row-meta">{product.publicationIssues?.map((issue) => issue.message).filter(Boolean).join(' · ') || 'Prontidão ainda não calculada'}</div></div><TechnicalLink href={`/admin/collections/products/${product.id}`}>Corrigir</TechnicalLink></div>)}</div> : <p className="esmera-card-copy">Nenhum rascunho com problemas reais de publicação foi encontrado.</p>}
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
    const result = await findDocs<Product>(props.initPageResult.req, 'products', {
      sort: '-updatedAt',
      limit: 100,
      depth: 0,
      select: {
        id: true,
        title: true,
        code: true,
        catalogStatus: true,
        availability: true,
        _status: true,
        updatedAt: true,
      },
    })
    return <ViewFrame props={props}>
      <PageHeader eyebrow="Catálogo" title="Produtos" subtitle="Catálogo operacional. Os formulários completos, drafts e versões ficam no Admin técnico." actions={<TechnicalLink href="/admin/collections/products/create" primary>Novo produto</TechnicalLink>} />
      <section className="esmera-card"><div className="esmera-card-header"><h2>Catálogo</h2><span className="esmera-pill esmera-pill--green">{result.totalDocs} registros</span></div>{result.docs.length ? <ul className="esmera-list">{result.docs.map((product) => <li className="esmera-list-row" key={String(product.id)}><div><a className="esmera-row-title" href={`/admin/collections/products/${product.id}`}>{product.title || 'Produto sem título'}</a><span className="esmera-row-meta">{product.code || 'Sem código'} · {product.availability || 'sem disponibilidade'} · atualizado {shortDate(product.updatedAt)}</span></div><div style={{ display: 'flex', gap: 6 }}><span className={`esmera-pill ${product.catalogStatus === 'active' ? 'esmera-pill--green' : ''}`}>{product.catalogStatus === 'active' ? 'Ativo' : 'Arquivado'}</span><span className="esmera-pill">{product._status === 'published' ? 'Publicado' : 'Rascunho'}</span></div></li>)}</ul> : <EmptyState title="Nenhum produto" copy="Crie o primeiro produto para iniciar o catálogo." />}</section>
    </ViewFrame>
  } catch (error) { return <ViewFrame props={props}><PageHeader title="Produtos" subtitle="Catálogo" /><QueryError title="Não foi possível consultar produtos" error={error} /></ViewFrame> }
}

export async function CategoriesView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'site')
  if (!allowed) return <AccessDenied props={props} area="editorial" />
  try {
    const result = await findDocs<Category>(props.initPageResult.req, 'categories', {
      sort: 'order',
      limit: 100,
      depth: 0,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        order: true,
        updatedAt: true,
      },
    })
    return <ViewFrame props={props}>
      <PageHeader eyebrow="Catálogo" title="Categorias" subtitle="Estrutura editorial do catálogo, sem duplicar informações dos produtos." actions={<TechnicalLink href="/admin/collections/categories/create" primary>Nova categoria</TechnicalLink>} />
      <section className="esmera-card"><div className="esmera-card-header"><h2>Estrutura de categorias</h2><span className="esmera-pill">{result.totalDocs} registros</span></div>{result.docs.length ? <ul className="esmera-list">{result.docs.map((category) => <li className="esmera-list-row" key={String(category.id)}><div><a className="esmera-row-title" href={`/admin/collections/categories/${category.id}`}>{category.title || 'Categoria sem título'}</a><span className="esmera-row-meta">/{category.slug || 'sem-slug'} · ordem {category.order ?? '—'} · {shortDate(category.updatedAt)}</span></div><span className={`esmera-pill ${category.status === 'active' ? 'esmera-pill--green' : ''}`}>{category.status === 'active' ? 'Ativa' : 'Arquivada'}</span></li>)}</ul> : <EmptyState title="Nenhuma categoria" copy="Crie categorias antes de publicar produtos ativos." />}</section>
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

  if (!user) return <AccessDenied props={props} area="técnica" />

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
    ['Pós-venda', '/admin/collections/after-sales', 'Follow-ups, entregas e ocorrências.'],
    ['Tarefas', '/admin/collections/tasks', 'Pendências operacionais vinculadas aos registros.'],
    ['Atividades', '/admin/collections/activities', 'Linha do tempo de contatos, mensagens, propostas e mudanças.'],
  ]

  const renderEntries = (entries: string[][]) => (
    <div className="esmera-grid-3">
      {entries.map(([title, href, copy]) => (
        <section className="esmera-card" key={href}>
          <div className="esmera-card-body">
            <span className="esmera-eyebrow">Admin técnico</span>
            <h2 style={{ marginTop: 8 }}>{title}</h2>
            <p className="esmera-card-copy">{copy}</p>
            <TechnicalLink href={href}>Abrir</TechnicalLink>
          </div>
        </section>
      ))}
    </div>
  )

  return (
    <ViewFrame props={props}>
      <PageHeader
        eyebrow="Sistema"
        title="Admin técnico"
        subtitle="Formulários completos, drafts, versões e capacidades avançadas do Payload. É a mesma fonte de dados do portal operacional."
      />
      <div className="esmera-state">
        <strong>Uma única verdade</strong>
        <p>O portal operacional organiza tarefas frequentes. Esta área expõe a profundidade técnica sem criar outra base, outro schema ou indicadores paralelos.</p>
      </div>
      {site ? <><h2 style={{ marginTop: 30 }}>Site e catálogo</h2>{renderEntries(siteEntries)}</> : null}
      {business ? <><h2 style={{ marginTop: 30 }}>Business</h2>{renderEntries(businessEntries)}</> : null}
      {role === 'admin' ? <><h2 style={{ marginTop: 30 }}>Sistema</h2>{renderEntries([['Usuários', '/admin/collections/users', 'Acesso, autenticação e papéis de usuário.']])}</> : null}
    </ViewFrame>
  )
}
