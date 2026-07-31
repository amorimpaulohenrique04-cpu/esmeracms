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

type Category = {
  id: string | number
  title?: string | null
  slug?: string | null
  status?: string | null
  order?: number | null
  updatedAt?: string
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
  } catch (error) {
    return <ViewFrame props={props}><PageHeader title="Categorias" subtitle="Catálogo" /><QueryError title="Não foi possível consultar categorias" error={error} /></ViewFrame>
  }
}
