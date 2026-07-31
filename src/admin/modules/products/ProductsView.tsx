/* eslint-disable react-hooks/error-boundaries -- Query failures are handled here; render failures remain handled by the Next.js/Payload boundaries. */
import type { AdminViewServerProps } from 'payload'

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
} from '../../views/shared'

type Product = {
  id: string | number
  title?: string | null
  code?: string | null
  catalogStatus?: string | null
  availability?: string | null
  _status?: string | null
  updatedAt?: string
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
  } catch (error) {
    return <ViewFrame props={props}><PageHeader title="Produtos" subtitle="Catálogo" /><QueryError title="Não foi possível consultar produtos" error={error} /></ViewFrame>
  }
}
