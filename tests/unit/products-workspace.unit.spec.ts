/**
 * PR-07 — painel detalhado do resultado da publicação em lote.
 *
 * O painel consome `BulkPublicationResult` (PR-06) direto do contrato: os testes
 * abaixo montam respostas na forma real do endpoint e verificam agrupamento por
 * status do contrato, issues estruturadas, retry seletivo, foco e relatório.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  BulkPublicationItemResult,
  BulkPublicationResult,
  PublicationIssue,
} from '../../src/server/publication/types'

const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) =>
    React.createElement('a', { href, ...props }, children),
}))

vi.mock('@dnd-kit/react', () => ({
  DragDropProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}))

vi.mock('@dnd-kit/react/sortable', () => ({
  isSortable: () => false,
  useSortable: () => ({ ref: () => undefined, handleRef: () => undefined, isDragging: false }),
}))

const { ProductsWorkspaceClient } = await import('../../src/admin/modules/products/ProductsWorkspaceClient')

const LIST_UPDATED_AT = '2026-01-01T10:00:00.000Z'
const DRAFT_UPDATED_AT = '2026-01-01T10:05:00.000Z'

const filters = {
  q: '',
  status: 'all',
  availability: 'all',
  publication: 'all',
  category: 'all',
  page: 1,
  limit: 50 as const,
  view: 'list' as const,
}

const products = [
  { id: 1, title: 'Anel Solar', updatedAt: LIST_UPDATED_AT },
  { id: 2, title: 'Colar Lua', updatedAt: LIST_UPDATED_AT },
  { id: 3, title: 'Brinco Estrela', updatedAt: LIST_UPDATED_AT },
  { id: 4, title: 'Pulseira Rio', updatedAt: LIST_UPDATED_AT },
  { id: 5, title: 'Broche Sol', updatedAt: LIST_UPDATED_AT },
]

function issue(overrides: Partial<PublicationIssue> = {}): PublicationIssue {
  return {
    code: 'product.price_required',
    severity: 'blocker',
    path: 'basePriceCents',
    tab: 'Comercial',
    label: 'Preço base',
    message: 'Informe o preço base antes de publicar.',
    suggestion: 'Preencha o valor em reais na aba Comercial.',
    source: 'readiness',
    ...overrides,
  }
}

function bulk(results: BulkPublicationItemResult[]): BulkPublicationResult {
  return {
    requested: results.length,
    published: results.filter((item) => item.status === 'published').length,
    blocked: results.filter((item) => item.status === 'blocked').length,
    conflicts: results.filter((item) => item.status === 'revision_conflict').length,
    failed: results.filter((item) => item.status === 'failed').length,
    results,
  }
}

const partialResult = bulk([
  { id: 1, title: 'Anel Solar', status: 'published', message: 'Produto publicado.', updatedAt: DRAFT_UPDATED_AT },
  {
    id: 2,
    title: 'Colar Lua',
    status: 'blocked',
    message: 'Existem pendências que impedem a publicação.',
    updatedAt: DRAFT_UPDATED_AT,
    issues: [issue()],
  },
  {
    id: 3,
    title: 'Brinco Estrela',
    status: 'warning_requires_confirmation',
    message: 'Existem avisos que precisam de confirmação antes de publicar.',
    updatedAt: DRAFT_UPDATED_AT,
    confirmationToken: 'tok-3',
    issues: [issue({ code: 'product.price_review', severity: 'warning', label: 'Preço sob consulta', suggestion: undefined })],
  },
  { id: 4, title: 'Pulseira Rio', status: 'revision_conflict', message: 'Este conteúdo foi alterado em outra sessão.' },
  { id: 5, title: 'Broche Sol', status: 'failed', message: 'Não foi possível publicar o produto.' },
])

function mockPublishResponse(result: BulkPublicationResult) {
  return {
    ok: true,
    json: async () => ({ ok: true, result: { status: 'bulk_completed', meta: result } }),
  }
}

function renderWorkspace() {
  return render(React.createElement(ProductsWorkspaceClient, {
    products,
    categories: [],
    filters,
    totalDocs: products.length,
    totalPages: 1,
  }))
}

async function publishAll(result: BulkPublicationResult) {
  fireEvent.click(screen.getByLabelText('Selecionar página'))
  fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))
  await screen.findByRole('region', { name: 'Resultado da publicação em lote' })
  return result
}

function panel() {
  return screen.getByRole('region', { name: 'Resultado da publicação em lote' })
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  refresh.mockClear()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ProductsWorkspaceClient — painel de publicação em lote', () => {
  it('move um produto e persiste a ordem editorial completa', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ updated: products.length }) })

    renderWorkspace()
    fireEvent.change(screen.getByLabelText('Mover Anel Solar para posição'), { target: { value: '2' } })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as { action: string; orderedIds: number[] }
    expect(body).toEqual({ action: 'reorder', orderedIds: [2, 1, 3, 4, 5] })
    expect(await screen.findByText(/Anel Solar movido para a posição 2/)).toBeTruthy()
    expect(refresh).toHaveBeenCalled()
  })

  it('lote totalmente publicado mantém os sucessos visíveis e não move o foco', async () => {
    const result = bulk([
      { id: 1, title: 'Anel Solar', status: 'published', message: 'Produto publicado.' },
      { id: 2, title: 'Colar Lua', status: 'published', message: 'Produto publicado.' },
      { id: 3, title: 'Brinco Estrela', status: 'published', message: 'Produto publicado.' },
      { id: 4, title: 'Pulseira Rio', status: 'published', message: 'Produto publicado.' },
      { id: 5, title: 'Broche Sol', status: 'published', message: 'Produto publicado.' },
    ])
    fetchMock.mockResolvedValue(mockPublishResponse(result))

    renderWorkspace()
    await publishAll(result)

    const region = panel()
    expect(within(region).getByText('Publicado (5)')).toBeTruthy()
    expect(within(region).getAllByText('Anel Solar').length).toBeGreaterThan(0)
    expect(document.activeElement).not.toBe(region)
    expect(screen.getByText('5 de 5 produto(s) publicados.')).toBeTruthy()
  })

  it('lote parcial preserva os publicados e agrupa o restante pelos status do contrato', async () => {
    fetchMock.mockResolvedValue(mockPublishResponse(partialResult))

    renderWorkspace()
    await publishAll(partialResult)

    const region = panel()
    expect(within(region).getByText('Publicado (1)')).toBeTruthy()
    expect(within(region).getByText('Avisos aguardando confirmação (1)')).toBeTruthy()
    expect(within(region).getByText('Pendências impedem publicar (1)')).toBeTruthy()
    expect(within(region).getByText('Alterado em outra sessão (1)')).toBeTruthy()
    expect(within(region).getByText('Não foi possível publicar (1)')).toBeTruthy()

    // O sucesso continua representado mesmo com o lote parcial.
    expect(region.querySelector('li[data-status="published"]')).toBeTruthy()
    expect(within(region).getByText(/1 publicado\(s\)/)).toBeTruthy()
  })

  it('apresenta as issues estruturadas de cada item', async () => {
    fetchMock.mockResolvedValue(mockPublishResponse(partialResult))

    renderWorkspace()
    await publishAll(partialResult)

    const blocked = panel().querySelector('li[data-status="blocked"]') as HTMLElement
    expect(within(blocked).getByText('Preço base')).toBeTruthy()
    expect(within(blocked).getByText('Comercial')).toBeTruthy()
    expect(within(blocked).getByText('Informe o preço base antes de publicar.')).toBeTruthy()
    expect(within(blocked).getByText('Preencha o valor em reais na aba Comercial.')).toBeTruthy()
  })

  it('nova tentativa existe apenas no handshake de confirmação de avisos', async () => {
    fetchMock.mockResolvedValue(mockPublishResponse(partialResult))

    renderWorkspace()
    await publishAll(partialResult)

    const region = panel()
    const confirmable = [...region.querySelectorAll('li[data-can-confirm="true"]')].map((node) => node.getAttribute('data-status'))
    expect(confirmable).toEqual(['warning_requires_confirmation'])

    // O aviso com token tem a ação que o contrato descreve.
    const warning = region.querySelector('li[data-status="warning_requires_confirmation"]') as HTMLElement
    expect(within(warning).getByRole('button', { name: 'Confirmar avisos e publicar' })).toBeTruthy()

    // Nenhum outro status recebe retry inferido.
    expect(within(region).queryByRole('button', { name: /Tentar novamente/ })).toBeNull()

    const conflict = region.querySelector('li[data-status="revision_conflict"]') as HTMLElement
    expect(conflict.getAttribute('data-can-confirm')).toBe('false')
    expect(within(conflict).getAllByRole('button').map((node) => node.textContent)).toEqual(['Recarregar'])

    const blocked = region.querySelector('li[data-status="blocked"]') as HTMLElement
    expect(blocked.getAttribute('data-can-confirm')).toBe('false')
    expect(within(blocked).queryAllByRole('button')).toHaveLength(0)
    expect(within(blocked).getByRole('link', { name: 'Corrigir produto' })).toBeTruthy()

    const failed = region.querySelector('li[data-status="failed"]') as HTMLElement
    expect(failed.getAttribute('data-can-confirm')).toBe('false')
    expect(within(failed).queryAllByRole('button')).toHaveLength(0)
    expect(within(failed).queryAllByRole('link')).toHaveLength(0)
    expect(within(failed).getByText('Não foi possível publicar o produto.')).toBeTruthy()
  })

  it('aviso sem confirmationToken não oferece nova tentativa', async () => {
    const result = bulk([
      { id: 1, title: 'Anel Solar', status: 'published', message: 'Produto publicado.' },
      {
        id: 3,
        title: 'Brinco Estrela',
        status: 'warning_requires_confirmation',
        message: 'Existem avisos que precisam de confirmação antes de publicar.',
        updatedAt: DRAFT_UPDATED_AT,
        issues: [issue({ severity: 'warning' })],
      },
    ])
    fetchMock.mockResolvedValue(mockPublishResponse(result))

    renderWorkspace()
    await publishAll(result)

    const warning = panel().querySelector('li[data-status="warning_requires_confirmation"]') as HTMLElement
    expect(warning.getAttribute('data-can-confirm')).toBe('false')
    expect(within(warning).queryAllByRole('button')).toHaveLength(0)
  })

  it('move o foco para o painel quando o resultado é parcial', async () => {
    fetchMock.mockResolvedValue(mockPublishResponse(partialResult))

    renderWorkspace()
    await publishAll(partialResult)

    await waitFor(() => expect(document.activeElement).toBe(panel()))
    expect(panel().getAttribute('tabindex')).toBe('-1')
    // Sem duplicação: o foco anuncia, a região live fica vazia.
    expect(screen.queryByText('1 de 5 produto(s) publicados.')).toBeNull()
  })

  it('copiar e exportar geram relatório apenas dos itens não concluídos', async () => {
    fetchMock.mockResolvedValue(mockPublishResponse(partialResult))
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })

    renderWorkspace()
    await publishAll(partialResult)

    fireEvent.click(screen.getByRole('button', { name: 'Copiar relatório' }))
    await waitFor(() => expect(writeText).toHaveBeenCalled())

    const report = writeText.mock.calls[0][0] as string
    expect(report).toContain('Colar Lua')
    expect(report).toContain('Pulseira Rio')
    expect(report).toContain('Preço base')
    expect(report).toContain('Nova tentativa: disponível (confirmação de avisos)')
    expect(report).toContain('Nova tentativa: indisponível')
    expect(report).not.toContain('Anel Solar')
    expect(await screen.findAllByText('Relatório copiado para a área de transferência.')).toBeTruthy()

    const createObjectURL = vi.fn().mockReturnValue('blob:report')
    const revokeObjectURL = vi.fn()
    const blobs: string[] = []
    vi.stubGlobal('URL', Object.assign(Object.create(URL), URL, { createObjectURL, revokeObjectURL }))
    vi.stubGlobal('Blob', class {
      constructor(parts: string[]) {
        blobs.push(parts.join(''))
      }
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    fireEvent.click(screen.getByRole('button', { name: 'Exportar relatório' }))
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:report')

    const exported = JSON.parse(blobs[0]) as ReturnType<typeof JSON.parse>
    expect(exported.items.map((item: { id: number }) => item.id)).toEqual([2, 3, 4, 5])
    expect(exported.summary.published).toBe(1)
  })

  it('a confirmação reenvia somente o item confirmado e preserva os concluídos', async () => {
    fetchMock.mockResolvedValue(mockPublishResponse(partialResult))

    renderWorkspace()
    await publishAll(partialResult)

    const retried = bulk([
      { id: 3, title: 'Brinco Estrela', status: 'published', message: 'Produto publicado.' },
    ])
    fetchMock.mockResolvedValue(mockPublishResponse(retried))

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar avisos e publicar' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string) as {
      action: string
      items: Array<{ id: number; expectedUpdatedAt: string; confirmationToken?: string }>
    }
    expect(body.action).toBe('publish')
    // Nem o publicado (1) nem os demais status entram no reenvio.
    expect(body.items).toEqual([{ id: 3, expectedUpdatedAt: DRAFT_UPDATED_AT, confirmationToken: 'tok-3' }])

    // O item já concluído no primeiro lote continua no painel.
    await waitFor(() => expect(within(panel()).getByText('Publicado (2)')).toBeTruthy())
    expect(within(panel()).getAllByText('Anel Solar').length).toBeGreaterThan(0)
  })
})
