'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import { Button, DataTable, EmptyState, InlineFeedback, Status } from '../../design-system'
import { expectAdminResponse, normalizeAdminError } from '../../state/asyncState'
import type { RelatedProduct } from './types'

type Props = {
  categoryId: string | number
  products: RelatedProduct[]
  total: number
}

type SearchResult = Pick<RelatedProduct, 'id' | 'title' | 'code' | '_status'>
type Feedback = { tone: 'success' | 'danger'; message: string }

const SEARCH_DELAY_MS = 250
const MIN_SEARCH_LENGTH = 2

export function CategoryProductsManager({ categoryId, products, total }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searchedTerm, setSearchedTerm] = useState('')
  const [busyId, setBusyId] = useState<string | number | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const term = query.trim()
  const searching = term !== searchedTerm

  useEffect(() => {
    if (term.length < MIN_SEARCH_LENGTH) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ productSearch: term, category: String(categoryId) })
        const response = await fetch(`/api/admin-categories?${params.toString()}`, { credentials: 'same-origin', signal: controller.signal })
        if (!response.ok) throw new Error('Não foi possível buscar produtos. Tente novamente.')
        const body = await response.json() as { docs: SearchResult[] }
        setResults(body.docs)
      } catch (error) {
        if (controller.signal.aborted) return
        setFeedback({ tone: 'danger', message: error instanceof Error ? error.message : 'Não foi possível buscar produtos.' })
      } finally {
        if (!controller.signal.aborted) setSearchedTerm(term)
      }
    }, SEARCH_DELAY_MS)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [categoryId, term])

  async function change(action: 'add-product' | 'remove-product', productId: string | number) {
    setBusyId(productId)
    setFeedback(null)
    try {
      const response = await fetch('/api/admin-categories', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ action, id: categoryId, productId }),
      })
      const result = await expectAdminResponse<{ message?: string }>(response, 'Não foi possível atualizar o produto.')
      setFeedback({ tone: 'success', message: result.message || 'Produto atualizado.' })
      setResults((current) => current.filter((product) => product.id !== productId))
      router.refresh()
    } catch (error) {
      setFeedback({ tone: 'danger', message: normalizeAdminError(error, 'Não foi possível atualizar o produto.').summary })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="esmera-category-related">
      <div className="esmera-category-related__intro">
        <div><span className="esmera-eyebrow">Produtos</span><h3>Produtos associados</h3></div>
        <p>Só produtos publicados aparecem no site. A categoria precisa estar publicada para receber produtos ativos.</p>
      </div>

      <label className="esmera-category-products__search">
        <span className="esmera-field-label">Adicionar produto</span>
        <input className="esmera-input" type="search" value={query} placeholder="Buscar por nome ou código" onChange={(event) => setQuery(event.target.value)} />
      </label>
      {term.length >= MIN_SEARCH_LENGTH ? (
        <ul className="esmera-category-products__results" aria-label="Resultados da busca">
          {!searching && results.map((product) => (
            <li key={String(product.id)}>
              <span><strong>{product.title || 'Produto sem título'}</strong> <small>{product.code || 'Sem código'}</small></span>
              <Button disabled={busyId !== null} onClick={() => void change('add-product', product.id)}>Adicionar</Button>
            </li>
          ))}
          {searching || !results.length ? <li className="esmera-category-products__none">{searching ? 'Buscando…' : 'Nenhum produto encontrado.'}</li> : null}
        </ul>
      ) : null}

      {feedback ? <InlineFeedback tone={feedback.tone}>{feedback.message}</InlineFeedback> : null}

      {products.length ? (
        <DataTable label="Produtos associados à categoria">
          <thead><tr><th>Produto</th><th>Situação</th><th><span className="esmera-sr-only">Ações</span></th></tr></thead>
          <tbody>
            {products.map((product) => (
              <tr key={String(product.id)}>
                <td>
                  <Link className="esmera-row-title" href={`/admin/products?product=${product.id}&tab=overview`}>{product.title || 'Produto sem título'}</Link>
                  <small className="esmera-category-related__code">{product.code || 'Sem código'}</small>
                </td>
                <td>
                  {product.catalogStatus !== 'active'
                    ? <Status tone="neutral">Arquivado</Status>
                    : <Status tone={product._status === 'published' ? 'success' : 'neutral'}>{product._status === 'published' ? 'No site' : 'Rascunho'}</Status>}
                </td>
                <td><Button disabled={busyId !== null} aria-label={`Remover ${product.title || 'produto'} da categoria`} onClick={() => void change('remove-product', product.id)}>Remover</Button></td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : <EmptyState title="Nenhum produto nesta categoria" copy="Busque acima para adicionar o primeiro produto." />}
      {total > products.length ? <p className="esmera-category-related__more">Mostrando {products.length} de {total}. Use a busca de Produtos para ver todos.</p> : null}
    </div>
  )
}
