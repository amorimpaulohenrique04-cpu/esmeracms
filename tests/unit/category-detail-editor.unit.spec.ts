/**
 * PR-09 — Categoria sobre o FormSystem existente.
 *
 * Arquivo em `.ts` com `React.createElement`: o `include` do vitest.config.mts
 * coleta apenas `tests/unit/**\/*.unit.spec.ts` e a config está fora do escopo.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}))

const { CategoryDetailEditor } = await import('../../src/admin/modules/categories/CategoryDetailEditor')

type RequestBody = {
  action: string
  data?: Record<string, unknown>
  expectedRevision?: string | null
  expectedUpdatedAt?: string | null
}

const category = {
  id: 3,
  title: 'Anéis',
  slug: 'aneis',
  status: 'active',
  order: 100,
  _status: 'draft',
  updatedAt: '2026-02-01T09:00:00.000Z',
  revision: 'rev-3',
  description: 'Peças de dedo.',
  productCount: 4,
  depth: 0,
  seo: { title: 'Anéis Esméra', description: 'SEO', noIndex: false },
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

const savedResponse = () => jsonResponse({
  ok: true,
  result: { status: 'saved', revision: 'rev-4', message: 'Rascunho salvo.', meta: { updatedAt: '2026-02-01T10:00:00.000Z' } },
})

const publishedResponse = () => jsonResponse({
  ok: true,
  result: { status: 'published', revision: 'rev-5', message: 'Categoria publicada.' },
})

const validationResponse = () => jsonResponse({
  ok: false,
  error: {
    code: 'validation_error',
    summary: 'Revise os campos destacados.',
    message: 'Revise os campos destacados.',
    traceId: 'trace-9',
    retryable: false,
    fieldErrors: [
      {
        path: 'seo',
        message: 'Informe o título de SEO.',
        tab: 'seo',
        anchor: 'category-seo',
        label: 'SEO',
        severity: 'blocker',
      },
      { path: '$document', message: 'Revise a categoria inteira.', tab: 'review', severity: 'blocker' },
    ],
    entityErrors: [],
  },
}, 422)

const conflictResponse = () => jsonResponse({
  ok: false,
  error: {
    code: 'revision_conflict',
    summary: 'Este conteúdo foi alterado em outra sessão.',
    message: 'Este conteúdo foi alterado em outra sessão.',
    traceId: 'trace-409',
    retryable: false,
    fieldErrors: [],
    entityErrors: [],
  },
}, 409)

let fetchMock: ReturnType<typeof vi.fn>
let bodies: RequestBody[]

function renderEditor(relatedSection?: React.ReactNode) {
  return render(React.createElement(CategoryDetailEditor, {
    category,
    categories: [],
    media: [],
    termSuggestions: [],
    initialRevision: 'rev-3',
    initialUpdatedAt: '2026-02-01T09:00:00.000Z',
    relatedSection: relatedSection ?? React.createElement('p', null, '4 produtos relacionados'),
  }))
}

function actionBar() {
  return screen.getByRole('region', { name: 'Ações do documento' })
}

function summary() {
  return document.querySelector('.esmera-error-summary')
}

function tabNav() {
  return screen.getByRole('navigation', { name: 'Seções de Edição da categoria' })
}

beforeEach(() => {
  refresh.mockClear()
  bodies = []
  fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body ?? '{}')))
    return Promise.resolve(savedResponse())
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('CategoryDetailEditor — FormSystem', () => {
  it('renderiza dentro do FormShell', () => {
    const { container } = renderEditor()
    expect(container.querySelector('.esmera-form-shell')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Edição da categoria' })).toBeTruthy()
  })

  it('mantém exatamente as três abas', () => {
    renderEditor()
    expect(within(tabNav()).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Geral', 'Mídia & SEO', 'Produtos relacionados',
    ])
  })

  it('a ActionBar reflete o dirty state real', () => {
    renderEditor()
    const bar = actionBar()
    expect(within(bar).getByText('Rascunho sincronizado')).toBeTruthy()
    expect(within(bar).getByRole('button', { name: 'Salvar rascunho' }).hasAttribute('disabled')).toBe(true)

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Anéis autorais' } })
    expect(within(bar).getByText('Alterações não salvas')).toBeTruthy()
    expect(within(bar).getByRole('button', { name: 'Salvar rascunho' }).hasAttribute('disabled')).toBe(false)
  })

  it('salvar rascunho usa o callback existente com o estado visível', async () => {
    renderEditor()
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Anéis autorais' } })
    fireEvent.click(within(actionBar()).getByRole('button', { name: 'Salvar rascunho' }))

    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0].action).toBe('save-draft')
    expect(bodies[0].data?.title).toBe('Anéis autorais')
    expect(bodies[0].expectedRevision).toBe('rev-3')
    expect(bodies[0].expectedUpdatedAt).toBe('2026-02-01T09:00:00.000Z')
    await screen.findByText('Rascunho salvo.')
  })

  it('salvar e publicar envia o estado visível e aguarda o rascunho pendente', async () => {
    renderEditor()
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as RequestBody
      bodies.push(body)
      return Promise.resolve(body.action === 'save-draft' ? savedResponse() : publishedResponse())
    })

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Anéis autorais' } })
    fireEvent.click(within(actionBar()).getByRole('button', { name: 'Salvar e publicar' }))

    await waitFor(() => expect(bodies.map((body) => body.action)).toEqual(['save-draft', 'save-and-publish']))
    expect(bodies[1].data?.title).toBe('Anéis autorais')
    // A revisão usada é a devolvida pelo save, nunca sintetizada no cliente.
    expect(bodies[1].expectedRevision).toBe('rev-4')
    await screen.findByText('Categoria publicada.')
  })

  it('erro ao salvar impede a chamada de publicação', async () => {
    renderEditor()
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body ?? '{}')))
      return Promise.resolve(jsonResponse({ ok: false, error: { code: 'internal_error', summary: 'Falha ao salvar.' } }, 500))
    })

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Anéis autorais' } })
    fireEvent.click(within(actionBar()).getByRole('button', { name: 'Salvar e publicar' }))

    await waitFor(() => expect(bodies).toHaveLength(1))
    await waitFor(() => expect(summary()).toBeTruthy())
    expect(bodies.every((body) => body.action !== 'save-and-publish')).toBe(true)
    // Erro de transporte não pode marcar o formulário como salvo.
    expect(within(actionBar()).getByText('Alterações não salvas')).toBeTruthy()
  })

  it('o estado de carregamento impede submissão duplicada', async () => {
    renderEditor()
    let release = () => {}
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body ?? '{}')))
      return new Promise<Response>((resolve) => { release = () => resolve(publishedResponse()) })
    })

    const publishButton = within(actionBar()).getByRole('button', { name: 'Salvar e publicar' })
    fireEvent.click(publishButton)
    await waitFor(() => expect(publishButton.hasAttribute('disabled')).toBe(true))
    fireEvent.click(publishButton)
    expect(bodies).toHaveLength(1)

    release()
    await screen.findByText('Categoria publicada.')
  })

  it('falha estruturada renderiza o ErrorSummary e move o foco', async () => {
    renderEditor()
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body ?? '{}')))
      return Promise.resolve(validationResponse())
    })

    fireEvent.click(within(actionBar()).getByRole('button', { name: 'Salvar e publicar' }))
    await waitFor(() => expect(summary()).toBeTruthy())

    const region = summary() as HTMLElement
    expect(within(region).getByText('Revise os campos destacados.')).toBeTruthy()
    expect(within(region).getByText('Referência técnica: trace-9')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(region))
  })

  it('ativar uma issue abre a aba indicada e foca o campo real', async () => {
    renderEditor()
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body ?? '{}')))
      return Promise.resolve(validationResponse())
    })

    fireEvent.click(within(actionBar()).getByRole('button', { name: 'Salvar e publicar' }))
    await waitFor(() => expect(summary()).toBeTruthy())
    expect(screen.queryByLabelText('Título SEO')).toBeNull()

    fireEvent.click(within(summary() as HTMLElement).getByRole('button', { name: 'Informe o título de SEO.' }))

    const control = await screen.findByLabelText('Título SEO')
    expect(control.id).toBe('category-seo')
    await waitFor(() => expect(document.activeElement).toBe(control))
    expect(control.getAttribute('aria-invalid')).toBe('true')
    expect(control.getAttribute('aria-errormessage')).toBe('category-seo-error')
    expect(control.getAttribute('aria-describedby')).toContain('category-seo-error')

    // Issue sem destino permanece listada, sem inventar mapeamento.
    expect(within(summary() as HTMLElement).getByRole('button', { name: 'Revise a categoria inteira.' })).toBeTruthy()
  })

  it('no carregamento inicial não há resumo nem foco automático', () => {
    renderEditor()
    expect(summary()).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(document.activeElement).toBe(document.body)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('conflito de revisão não sobrescreve e oferece recarregar', async () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })

    renderEditor()
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body ?? '{}')))
      return Promise.resolve(conflictResponse())
    })

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Anéis autorais' } })
    fireEvent.click(within(actionBar()).getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(() => expect(summary()).toBeTruthy())

    // Aviso persistente, alterações locais preservadas e nenhum retry silencioso.
    expect(screen.getByText(/alterada em outra sessão/)).toBeTruthy()
    expect(screen.getByLabelText('Nome')).toHaveProperty('value', 'Anéis autorais')
    expect(within(actionBar()).getByText('Alterações não salvas')).toBeTruthy()
    expect(bodies).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Recarregar versão atual' }))
    expect(reload).toHaveBeenCalled()
    expect(bodies).toHaveLength(1)
  })

  it('produtos relacionados permanecem derivados e fora da mutation', async () => {
    const { rerender } = renderEditor()

    fireEvent.click(within(tabNav()).getByRole('button', { name: 'Produtos relacionados' }))
    expect(screen.getByText('4 produtos relacionados')).toBeTruthy()
    // A consulta derivada não marca o formulário como sujo.
    expect(within(actionBar()).getByText('Rascunho sincronizado')).toBeTruthy()

    rerender(React.createElement(CategoryDetailEditor, {
      category,
      categories: [],
      media: [],
      termSuggestions: [],
      initialRevision: 'rev-3',
      initialUpdatedAt: '2026-02-01T09:00:00.000Z',
      relatedSection: React.createElement('p', null, '5 produtos relacionados'),
    }))
    expect(screen.getByText('5 produtos relacionados')).toBeTruthy()
    expect(within(actionBar()).getByText('Rascunho sincronizado')).toBeTruthy()

    fireEvent.click(within(tabNav()).getByRole('button', { name: 'Geral' }))
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Anéis autorais' } })
    fireEvent.click(within(actionBar()).getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(() => expect(bodies).toHaveLength(1))

    expect(Object.keys(bodies[0].data ?? {}).sort()).toEqual([
      'description', 'image', 'order', 'parent', 'searchTerms', 'seo', 'slug', 'status', 'title',
    ])
  })
})
