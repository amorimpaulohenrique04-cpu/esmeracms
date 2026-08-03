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

function mediaURL(value: unknown) {
  const record = object(value)
  const url = text(record?.url)
  if (!url) return null
  return url.startsWith('http') || url.startsWith('/') ? url : `/${url}`
}

function money(cents: unknown) {
  const value = number(cents)
  return value === null ? 'Sob consulta' : (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function gallery(record: PreviewRecord) {
  return (Array.isArray(record.gallery) ? record.gallery : []).map((item) => {
    const row = object(item)
    const image = object(row?.image) || object(row?.media) || row
    const url = mediaURL(image)
    return url ? { url, alt: text(row?.alt) || text(image?.alt) || text(record.title) } : null
  }).filter((item): item is { url: string; alt: string } => Boolean(item))
}

function ProductPreview({ record }: { record: PreviewRecord }) {
  const images = gallery(record)
  return (
    <article className="preview-document">
      <header><strong>ESMÉRA</strong><span>Preview de rascunho</span></header>
      <main className="preview-product">
        <div className="preview-media">{images[0] ? <img src={images[0].url} alt={images[0].alt} /> : <span>Imagem principal</span>}</div>
        <section>
          <small>{text(record.availability, 'Disponibilidade não definida')}</small>
          <h1>{text(record.title, 'Produto sem título')}</h1>
          <p>{text(record.subtitle, 'Subtítulo editorial ainda não definido.')}</p>
          <dl>
            <div><dt>Material</dt><dd>{text(record.material, 'Não informado')}</dd></div>
            <div><dt>Edição</dt><dd>{text(record.edition, 'Peça singular')}</dd></div>
            <div><dt>Preço</dt><dd>{text(record.priceMode) === 'fixed' ? money(record.basePriceCents) : 'Sob consulta'}</dd></div>
          </dl>
        </section>
      </main>
    </article>
  )
}

function CategoryPreview({ record }: { record: PreviewRecord }) {
  const image = object(record.image)
  const src = mediaURL(image)
  return (
    <article className="preview-document">
      <header><strong>ESMÉRA</strong><span>Preview de rascunho</span></header>
      <main className="preview-category">
        <div className="preview-media">{src ? <img src={src} alt={text(image?.alt) || text(record.title)} /> : <span>Imagem da categoria</span>}</div>
        <section>
          <small>{text(record.status) === 'active' ? 'Categoria ativa' : 'Categoria em rascunho'}</small>
          <h1>{text(record.title, 'Categoria sem título')}</h1>
          <p>{text(record.description, 'Descrição editorial ainda não definida.')}</p>
          <code>/{text(record.slug, 'categoria')}</code>
        </section>
      </main>
    </article>
  )
}

export function EditorialPreviewDocument({ kind, record }: { kind: PreviewKind; record: PreviewRecord }) {
  return kind === 'product' ? <ProductPreview record={record} /> : <CategoryPreview record={record} />
}
