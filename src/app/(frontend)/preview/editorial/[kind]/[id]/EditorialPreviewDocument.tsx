'use client'

import React from 'react'

type PreviewKind = 'product' | 'category'
type PreviewRecord = Record<string, unknown>

function object(value: unknown): PreviewRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as PreviewRecord : null
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function number(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function relation(value: unknown) {
  return object(value)
}

function mediaURL(value: unknown) {
  const record = relation(value)
  const url = text(record?.url)
  if (!url) return null
  return url.startsWith('http') || url.startsWith('/') ? url : `/${url}`
}

function money(cents: unknown) {
  const value = number(cents)
  if (value === null) return 'Sob consulta'
  return (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function notifyField(field: string) {
  if (window.parent === window) return
  window.parent.postMessage({ type: 'esmera-editorial-preview-field', field }, window.location.origin)
}

function PreviewField({ field, label, className = '', children }: { field: string; label: string; className?: string; children: React.ReactNode }) {
  return (
    <button className={`esmera-editorial-document__field${className ? ` ${className}` : ''}`} type="button" onClick={() => notifyField(field)} aria-label={`Editar ${label}`}>
      {children}
      <span className="esmera-editorial-document__edit">Editar {label}</span>
    </button>
  )
}

function galleryImages(record: PreviewRecord) {
  const gallery = Array.isArray(record.gallery) ? record.gallery : []
  return gallery.map((item) => {
    const row = object(item)
    const image = relation(row?.image) || relation(row?.media) || row
    const url = mediaURL(image)
    return url ? { url, alt: text(row?.alt) || text(image?.alt) || text(record.title) } : null
  }).filter((item): item is { url: string; alt: string } => Boolean(item))
}

function ProductPreview({ record }: { record: PreviewRecord }) {
  const images = galleryImages(record)
  const availabilityLabels: Record<string, string> = {
    available: 'Disponível',
    limited: 'Edição limitada',
    made_to_order: 'Sob encomenda',
    unavailable: 'Indisponível',
  }
  const availability = text(record.availability)

  return (
    <article className="esmera-editorial-document esmera-editorial-document--product">
      <header className="esmera-editorial-document__masthead">
        <span>ESMÉRA</span>
        <small>Objeto de matéria singular</small>
      </header>

      <div className="esmera-editorial-product__hero">
        <PreviewField field="gallery" label="mídia" className="esmera-editorial-product__media">
          {images[0] ? <img src={images[0].url} alt={images[0].alt} /> : <div className="esmera-editorial-document__media-empty">Imagem principal do produto</div>}
        </PreviewField>

        <section className="esmera-editorial-product__summary">
          <PreviewField field="availability" label="disponibilidade" className="esmera-editorial-product__availability">
            <span>{availabilityLabels[availability] || availability || 'Disponibilidade não definida'}</span>
          </PreviewField>
          <PreviewField field="title" label="título"><h1>{text(record.title, 'Produto sem título')}</h1></PreviewField>
          <PreviewField field="subtitle" label="subtítulo"><p className="esmera-editorial-product__subtitle">{text(record.subtitle, 'Subtítulo editorial ainda não definido.')}</p></PreviewField>
          <PreviewField field="material" label="material"><p className="esmera-editorial-product__material">{text(record.material, 'Material não informado')}</p></PreviewField>
          <PreviewField field="basePriceCents" label="preço"><strong className="esmera-editorial-product__price">{text(record.priceMode) === 'fixed' ? money(record.basePriceCents) : 'Sob consulta'}</strong></PreviewField>
          <div className="esmera-editorial-product__cta">Consultar peça pelo WhatsApp</div>
        </section>
      </div>

      <div className="esmera-editorial-product__details">
        <PreviewField field="edition" label="edição"><div><span>Edição</span><strong>{text(record.edition, 'Peça singular')}</strong></div></PreviewField>
        <PreviewField field="material" label="material"><div><span>Matéria</span><strong>{text(record.material, 'Não informada')}</strong></div></PreviewField>
        <PreviewField field="description" label="descrição"><div><span>Descrição</span><p>{text(record.description, 'A descrição completa aparecerá aqui quando estiver cadastrada.')}</p></div></PreviewField>
      </div>

      {images.length > 1 ? <section className="esmera-editorial-product__gallery">{images.slice(1, 5).map((image, index) => <PreviewField field="gallery" label="galeria" key={`${image.url}-${index}`}><img src={image.url} alt={image.alt} /></PreviewField>)}</section> : null}
    </article>
  )
}

function CategoryPreview({ record }: { record: PreviewRecord }) {
  const image = relation(record.image)
  const imageSrc = mediaURL(image)
  const seo = object(record.seo)
  const terms = Array.isArray(record.searchTerms) ? record.searchTerms.map((item) => text(object(item)?.term)).filter(Boolean) : []

  return (
    <article className="esmera-editorial-document esmera-editorial-document--category">
      <header className="esmera-editorial-document__masthead"><span>ESMÉRA</span><small>Coleções e matérias</small></header>
      <div className="esmera-editorial-category__hero">
        <PreviewField field="image" label="imagem" className="esmera-editorial-category__media">
          {imageSrc ? <img src={imageSrc} alt={text(image?.alt) || text(record.title)} /> : <div className="esmera-editorial-document__media-empty">Imagem da categoria</div>}
        </PreviewField>
        <div className="esmera-editorial-category__copy">
          <PreviewField field="status" label="status"><span className="esmera-editorial-category__status">{text(record.status) === 'active' ? 'Coleção ativa' : 'Coleção arquivada'}</span></PreviewField>
          <PreviewField field="title" label="nome"><h1>{text(record.title, 'Categoria sem nome')}</h1></PreviewField>
          <PreviewField field="description" label="descrição"><p>{text(record.description, 'Descrição editorial ainda não definida.')}</p></PreviewField>
          <PreviewField field="slug" label="slug"><small>/{text(record.slug, 'categoria')}</small></PreviewField>
        </div>
      </div>

      <section className="esmera-editorial-category__taxonomy">
        <PreviewField field="searchTerms" label="taxonomia">
          <span>Taxonomia & sinônimos</span>
          <div>{terms.length ? terms.map((term) => <strong key={term}>{term}</strong>) : <em>Nenhum termo adicional.</em>}</div>
        </PreviewField>
      </section>

      <section className="esmera-editorial-category__seo">
        <PreviewField field="seoTitle" label="título SEO"><div><span>Título de busca</span><strong>{text(seo?.title) || text(record.title, 'Título da categoria')}</strong></div></PreviewField>
        <PreviewField field="seoDescription" label="descrição SEO"><div><span>Descrição de busca</span><p>{text(seo?.description) || text(record.description, 'Sem descrição SEO definida.')}</p></div></PreviewField>
      </section>
    </article>
  )
}

export function EditorialPreviewDocument({ kind, record }: { kind: PreviewKind; record: PreviewRecord }) {
  return kind === 'product' ? <ProductPreview record={record} /> : <CategoryPreview record={record} />
}
