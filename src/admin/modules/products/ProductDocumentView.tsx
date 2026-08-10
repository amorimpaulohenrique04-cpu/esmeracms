import Link from 'next/link'
import React from 'react'

import { InlineFeedback, SectionNav, SectionNavLink, Status } from '../../design-system'
import { money, PageHeader, shortDate, TechnicalLink } from '../../views/shared'
import { ProductDraftForm } from './ProductDraftForm'
import { ProductMediaManager } from './ProductMediaManager'
import {
  availabilityLabels,
  coverItem,
  imageURL,
  type ProductCategory,
  type ProductDetail,
  type ProductDocumentTab,
} from './types'

const tabs: Array<{ value: ProductDocumentTab; label: string }> = [
  { value: 'overview', label: 'Visão geral' },
  { value: 'media', label: 'Mídia' },
  { value: 'commercial', label: 'Comercial' },
  { value: 'variants', label: 'Variantes' },
  { value: 'technical', label: 'Ficha técnica' },
  { value: 'seo', label: 'SEO' },
  { value: 'history', label: 'Histórico' },
]

function selectionLabel(product: ProductDetail, optionCode: string | null | undefined, valueCode: string | null | undefined) {
  const definition = (product.optionDefinitions || []).find((item) => item.code === optionCode)
  const value = (definition?.values || []).find((item) => item.value === valueCode)
  return `${definition?.label || optionCode || 'Opção'}: ${value?.label || valueCode || '—'}`
}

function categories(product: ProductDetail) {
  return (product.categories || []).filter((item): item is ProductCategory => typeof item === 'object' && item !== null)
}

function returnHref(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams()
  const get = (key: string) => {
    const value = params[key]
    return Array.isArray(value) ? value[0] : value
  }
  const mapping: Array<[string, string]> = [
    ['returnQ', 'q'],
    ['returnStatus', 'status'],
    ['returnAvailability', 'availability'],
    ['returnPublication', 'publication'],
    ['returnCategory', 'category'],
    ['returnPage', 'page'],
    ['returnLimit', 'limit'],
    ['returnView', 'view'],
  ]
  for (const [source, target] of mapping) {
    const value = get(source)
    if (value) query.set(target, value)
  }
  return query.size ? `/admin/products?${query.toString()}` : '/admin/products'
}

function tabHref(productId: string | number, tab: ProductDocumentTab, params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams()
  query.set('product', String(productId))
  query.set('tab', tab)
  for (const [key, value] of Object.entries(params)) {
    if (!key.startsWith('return') || value === undefined) continue
    query.set(key, Array.isArray(value) ? value[0] || '' : value)
  }
  return `/admin/products?${query.toString()}`
}

function Overview({ product }: { product: ProductDetail }) {
  const categoryItems = categories(product)
  const cover = coverItem(product.gallery)
  const coverURL = imageURL(cover)
  return (
    <div className="esmera-product-document-grid">
      <section className="esmera-card esmera-product-overview-media">
        {coverURL ? <img src={coverURL} alt={cover?.alt || product.title || ''} /> : <div className="esmera-product-document-placeholder">Sem imagem de capa</div>}
      </section>
      <div className="esmera-product-document-stack">
        <section className="esmera-card">
          <div className="esmera-card-header"><h2>Prontidão de publicação</h2></div>
          <div className="esmera-card-body">
            {product.publicationReady
              ? <InlineFeedback tone="success">O produto atende à regra única de prontidão calculada no servidor.</InlineFeedback>
              : <><InlineFeedback tone="warning">{product.publicationIssues?.length || 0} pendência{product.publicationIssues?.length === 1 ? '' : 's'} impedem a publicação.</InlineFeedback><ul className="esmera-product-issues">{(product.publicationIssues || []).map((issue, index) => <li key={`${issue.message}-${index}`}>{issue.message}</li>)}</ul></>}
          </div>
        </section>
        <section className="esmera-card"><div className="esmera-card-header"><h2>Identidade</h2></div><dl className="esmera-product-facts"><div><dt>Código</dt><dd>{product.code || '—'}</dd></div><div><dt>Slug</dt><dd>{product.slug || '—'}</dd></div><div><dt>Material</dt><dd>{product.material || '—'}</dd></div><div><dt>Edição</dt><dd>{product.edition || '—'}</dd></div><div><dt>Categorias</dt><dd>{categoryItems.length ? categoryItems.map((item) => item.title || item.slug || item.id).join(', ') : '—'}</dd></div></dl></section>
      </div>
      <div className="esmera-product-document-full"><ProductDraftForm productId={product.id} initial={{ title: product.title || '', subtitle: product.subtitle || '', material: product.material || '', edition: product.edition || '', availability: product.availability || 'available', priceMode: product.priceMode || 'inquiry', basePriceCents: typeof product.basePriceCents === 'number' ? String(product.basePriceCents) : '' }} published={product._status === 'published'} archived={product.catalogStatus === 'archived'} initialRevision={product.revision ?? null} initialUpdatedAt={product.updatedAt ?? null} initialPublicationIssues={product.publicationIssues ?? undefined} publicationReady={product.publicationReady ?? null} /></div>
    </div>
  )
}

function MediaTab({ product }: { product: ProductDetail }) {
  return <section className="esmera-card"><div className="esmera-card-header"><h2>Galeria</h2><span>{product.gallery?.length || 0}/12 imagens</span></div><div className="esmera-card-body"><ProductMediaManager productId={product.id} productTitle={product.title} initialGallery={product.gallery || []} /></div></section>
}

function CommercialTab({ product }: { product: ProductDetail }) {
  const enabledVariants = (product.variants || []).filter((variant) => variant.status !== 'disabled')
  return <div className="esmera-grid-equal"><section className="esmera-card"><div className="esmera-card-header"><h2>Oferta</h2></div><dl className="esmera-product-facts"><div><dt>Disponibilidade</dt><dd>{availabilityLabels[product.availability || ''] || '—'}</dd></div><div><dt>Modo de preço</dt><dd>{product.priceMode === 'fixed' ? 'Preço fixo' : 'Sob consulta'}</dd></div><div><dt>Preço base</dt><dd>{product.priceMode === 'fixed' ? money(product.basePriceCents) : 'Sob consulta'}</dd></div><div><dt>Variantes ativas</dt><dd>{enabledVariants.length}</dd></div></dl></section><section className="esmera-card"><div className="esmera-card-header"><h2>Regra comercial</h2></div><div className="esmera-card-body"><p className="esmera-card-copy">Preço fixo exige preço base utilizável ou preço próprio em variante ativa. Variantes podem herdar o preço do produto, ter preço próprio ou ficar sob consulta.</p></div></section></div>
}

function VariantsTab({ product }: { product: ProductDetail }) {
  return <div className="esmera-product-document-stack"><section className="esmera-card"><div className="esmera-card-header"><h2>Opções</h2><span>{product.optionDefinitions?.length || 0}</span></div>{product.optionDefinitions?.length ? <div className="esmera-card-body esmera-product-options">{product.optionDefinitions.map((definition) => <div key={String(definition.id || definition.code)}><strong>{definition.label || definition.code}</strong><div>{(definition.values || []).map((value) => <span className="esmera-product-option-chip" key={String(value.id || value.value)}>{value.swatch ? <i style={{ background: value.swatch }} /> : null}{value.label || value.value}</span>)}</div></div>)}</div> : <div className="esmera-empty"><strong>Sem opções</strong><span>Este produto não possui variações configuradas.</span></div>}</section><section className="esmera-card"><div className="esmera-card-header"><h2>Combinações</h2><span>{product.variants?.length || 0}</span></div>{product.variants?.length ? <div className="esmera-data-table-wrap"><table className="esmera-data-table"><thead><tr><th>SKU</th><th>Combinação</th><th>Preço</th><th>Status</th></tr></thead><tbody>{product.variants.map((variant) => <tr key={String(variant.id || variant.sku)}><td>{variant.sku || '—'}</td><td>{(variant.selection || []).map((item) => selectionLabel(product, item.option, item.value)).join(' · ') || '—'}</td><td>{variant.priceMode === 'fixed' ? money(variant.priceCents) : variant.priceMode === 'inherit' ? 'Herdar' : 'Sob consulta'}</td><td><Status tone={variant.status === 'disabled' ? 'neutral' : 'success'}>{variant.status === 'disabled' ? 'Desabilitada' : 'Ativa'}</Status></td></tr>)}</tbody></table></div> : <div className="esmera-empty"><strong>Sem variantes</strong><span>Cadastre opções e combinações no editor técnico quando necessário.</span></div>}</section></div>
}

function TechnicalTab({ product }: { product: ProductDetail }) {
  return <div className="esmera-grid-equal"><section className="esmera-card"><div className="esmera-card-header"><h2>Matéria e edição</h2></div><dl className="esmera-product-facts"><div><dt>Material</dt><dd>{product.material || '—'}</dd></div><div><dt>Edição</dt><dd>{product.edition || '—'}</dd></div></dl></section><section className="esmera-card"><div className="esmera-card-header"><h2>Ficha técnica</h2></div>{product.attributes?.length ? <dl className="esmera-product-facts">{product.attributes.map((attribute, index) => <div key={String(attribute.id || index)}><dt>{attribute.label || 'Campo'}</dt><dd>{attribute.value || '—'}</dd></div>)}</dl> : <div className="esmera-empty"><strong>Sem atributos</strong><span>Nenhuma informação técnica adicional cadastrada.</span></div>}</section></div>
}

function SeoTab({ product }: { product: ProductDetail }) {
  const seo = product.seo as (ProductDetail['seo'] & { socialImage?: unknown; noIndex?: boolean }) | null | undefined
  return <div className="esmera-grid-equal"><section className="esmera-card"><div className="esmera-card-header"><h2>Indexação</h2></div><dl className="esmera-product-facts"><div><dt>Slug</dt><dd>{product.slug || '—'}</dd></div><div><dt>Título SEO</dt><dd>{seo?.title || 'Herdar título do produto'}</dd></div><div><dt>Descrição SEO</dt><dd>{seo?.description || '—'}</dd></div><div><dt>Ocultar de buscadores</dt><dd>{seo?.noIndex ? 'Sim' : 'Não'}</dd></div></dl></section><section className="esmera-card"><div className="esmera-card-header"><h2>Descoberta interna</h2></div><div className="esmera-card-body"><div className="esmera-product-token-list">{(product.searchTerms || []).map((item, index) => <span key={String(item.id || index)}>{item.term}</span>)}{!(product.searchTerms || []).length ? <small>Sem termos adicionais.</small> : null}</div><div className="esmera-product-token-list">{(product.tags || []).map((item, index) => <span key={String(item.id || index)}>{item.tag}</span>)}{!(product.tags || []).length ? <small>Sem tags editoriais.</small> : null}</div></div></section></div>
}

function HistoryTab({ product }: { product: ProductDetail }) {
  return <section className="esmera-card"><div className="esmera-card-header"><h2>Histórico editorial</h2></div><dl className="esmera-product-facts"><div><dt>Criado</dt><dd>{shortDate(product.createdAt)}</dd></div><div><dt>Última atualização</dt><dd>{shortDate(product.updatedAt)}</dd></div><div><dt>Estado atual</dt><dd>{product._status === 'published' ? 'Publicado' : 'Rascunho'}</dd></div></dl><div className="esmera-card-body"><p className="esmera-card-copy">Versões, comparação e restauração continuam sob o mecanismo nativo de versões do Payload para manter a trilha auditável.</p><TechnicalLink href={`/admin/collections/products/${product.id}`}>Abrir histórico no Admin técnico</TechnicalLink></div></section>
}

export function ProductDocumentView({ product, tab, searchParams }: { product: ProductDetail; tab: ProductDocumentTab; searchParams: Record<string, string | string[] | undefined> }) {
  const back = returnHref(searchParams)
  const issueCount = product.publicationIssues?.length || 0
  const readinessLabel = product.publicationReady ? 'Pronto para publicar' : 'Com pendências'
  const context = <div className="esmera-product-document-status"><Status tone={product.catalogStatus === 'active' ? 'success' : 'neutral'}>{product.catalogStatus === 'active' ? 'Ativo' : 'Arquivado'}</Status><Status tone={product._status === 'published' ? 'info' : 'neutral'}>{product._status === 'published' ? 'Publicado' : 'Rascunho'}</Status><span className={`esmera-product-readiness${product.publicationReady ? ' is-ready' : ' has-issues'}`} title={product.publicationReady ? undefined : `${issueCount} pendência${issueCount === 1 ? '' : 's'} registrada${issueCount === 1 ? '' : 's'}`}><span aria-hidden="true" />{readinessLabel}</span></div>

  return (
    <>
      <PageHeader eyebrow="Produto" title={product.title || 'Produto sem título'} subtitle={`${product.code || 'Sem código'} · ${availabilityLabels[product.availability || ''] || 'sem disponibilidade'}`} actions={<><Link className="esmera-button" href={back}>Voltar ao catálogo</Link><TechnicalLink href={`/admin/collections/products/${product.id}`}>Admin técnico</TechnicalLink></>} context={context} />
      <SectionNav className="esmera-product-tabs" label="Seções do produto">{tabs.map((item) => <SectionNavLink key={item.value} active={tab === item.value} href={tabHref(product.id, item.value, searchParams)}>{item.label}</SectionNavLink>)}</SectionNav>
      <div className="esmera-product-tab-content">
        {tab === 'overview' ? <Overview product={product} /> : null}
        {tab === 'media' ? <MediaTab product={product} /> : null}
        {tab === 'commercial' ? <CommercialTab product={product} /> : null}
        {tab === 'variants' ? <VariantsTab product={product} /> : null}
        {tab === 'technical' ? <TechnicalTab product={product} /> : null}
        {tab === 'seo' ? <SeoTab product={product} /> : null}
        {tab === 'history' ? <HistoryTab product={product} /> : null}
      </div>
    </>
  )
}
