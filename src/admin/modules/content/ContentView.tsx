/* eslint-disable react-hooks/error-boundaries -- Query failures are handled here; render failures remain handled by the Next.js/Payload boundaries. */
import type { AdminViewServerProps, Where } from 'payload'

import {
  AccessDenied,
  ensureUser,
  findDocs,
  PageHeader,
  QueryError,
  TechnicalLink,
  ViewFrame,
} from '../../views/shared'

type Product = {
  id: string | number
  title?: string | null
  code?: string | null
  categories?: unknown[] | null
  gallery?: unknown[] | null
  publicationReady?: boolean | null
  publicationIssues?: Array<{ message?: string | null }> | null
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
