/**
 * PR-08 — `ProductDraftForm` sobre o FormSystem existente.
 *
 * Arquivo em `.ts` com `React.createElement`: o `include` do vitest.config.mts
 * coleta apenas `tests/unit/**\/*.unit.spec.ts`, e a config está fora do escopo
 * de alteração deste PR.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PublicationIssue } from '../../src/issues/types'

const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}))

const { ProductDraftForm } = await import('../../src/admin/modules/products/ProductDraftForm')

type RequestBody = { action: string }

const initial = {
  title: 'Anel Solar',
  subtitle: '',
  material: 'Ouro',
  edition: '',
  availability: 'available',
  priceMode: 'fixed',
  basePriceCents: '250000',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const savedResponse = () => jsonResponse({
  ok: true,
  result: { status: 'saved', revision: 'rev-8', meta: { updatedAt: '2026-02-01T10:00:00.000Z' } },
})

const publishedResponse = () => jsonResponse({
  ok: true,
  result: { status: 'published', revision: 'rev-9', message: 'Produto publicado.' },
})

const blockedResponse = () => jsonResponse({
  ok: false,
  error: {
    code: 'publication_blocked',
    summary: 'O rascunho foi salvo, mas ainda existem pendências para publicar.',
    message: 'O rascunho foi salvo, mas ainda existem pendências para publicar.',
    traceId: 'trace-42',
    retryable: false,
    fieldErrors: [
      {
        path: 'basePriceCents',
        message: 'Informe o preço base antes de publicar.',
        tab: 'commercial',
        anchor: 'product-base-price',
        label: 'Preço base',
        suggestion: 'Preencha o valor em reais.',
        severity: 'blocker',
      },
      {
        path: '$document',
        message: 'Revise o checklist de publicação.',
        tab: 'review',
        severity: 'blocker',
      },
    ],
    entityErrors: [],
  },
}, 422)

// Assessment carregado com o documento (ProductsView → ProductDocumentView).
const initialBlocker: PublicationIssue = {
  code: 'product.gallery_required',
  severity: 'blocker',
  path: 'gallery',
  tab: 'gallery',
  label: 'Galeria',
  message: 'Adicione ao menos uma imagem antes de publicar.',
  suggestion: 'Envie a foto principal da peça.',
  anchor: 'product-gallery',
  source: 'readiness',
}

const initialWarning: PublicationIssue = {
  code: 'product.price_review',
  severity: 'warning',
  path: 'basePriceCents',
  tab: 'commercial',
  label: 'Preço base',
  message: 'Confirme o preço antes de publicar.',
  anchor: 'product-base-price',
  source: 'readiness',
}

let fetchMock: ReturnType<typeof vi.fn>
let bodies: RequestBody[]

function checklist() {
  return screen.getByRole('region', { name: 'Checklist de publicação' })
}

function renderForm(props: Partial<React.ComponentProps<typeof ProductDraftForm>> = {}) {
  return render(React.createElement(ProductDraftForm, {
    productId: 7,
    initial,
    published: false,
    archived: false,
    initialRevision: 'rev-7',
    initialUpdatedAt: '2026-02-01T09:00:00.000Z',
    ...props,
  }))
}

function actionBar() {
  return screen.getByRole('region', { name: 'Ações do documento' })
}

function summary() {
  return document.querySelector('.esmera-error-summary')
}

async function failPublish() {
  fetchMock.mockImplementation(() => Promise.resolve(blockedResponse()))
  fireEvent.click(within(actionBar()).getByRole('button', { name: 'Salvar e publicar' }))
  await waitFor(() => expect(summary()).toBeTruthy())
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
})

describe('ProductDraftForm — FormSystem', () => {
  it('renderiza dentro do FormShell', () => {
    const { container } = renderForm()
    expect(container.querySelector('.esmera-form-shell')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Edição rápida do rascunho' })).toBeTruthy()
  })

  it('apresenta as sete abas exigidas', () => {
    renderForm()
    const nav = screen.getByRole('navigation', { name: 'Seções de Edição rápida do rascunho' })
    expect(within(nav).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Essencial', 'Conteúdo', 'Mídia', 'Comercial', 'Variantes', 'SEO', 'Avançado',
    ])
  })

  it('exibe status e revisão recebidos, sem sintetizar valores', () => {
    const { unmount } = renderForm()
    expect(screen.getByText('Rascunho')).toBeTruthy()
    expect(screen.getByText('Revisão rev-7')).toBeTruthy()
    unmount()

    renderForm({ published: true, initialRevision: null })
    expect(screen.getByText('Publicado')).toBeTruthy()
    expect(screen.queryByText(/^Revisão/)).toBeNull()
  })

  it('falha estruturada apresenta o ErrorSummary com as issues recebidas', async () => {
    renderForm()
    await failPublish()

    const region = summary() as HTMLElement
    expect(within(region).getByText('O rascunho foi salvo, mas ainda existem pendências para publicar.')).toBeTruthy()
    expect(within(region).getByRole('button', { name: 'Informe o preço base antes de publicar.' })).toBeTruthy()
    expect(within(region).getByText('Referência técnica: trace-42')).toBeTruthy()
  })

  it('falha explícita move o foco para o resumo', async () => {
    renderForm()
    await failPublish()
    await waitFor(() => expect(document.activeElement).toBe(summary()))
  })

  it('no carregamento inicial não há resumo nem foco automático', () => {
    renderForm()
    expect(summary()).toBeNull()
    expect(document.activeElement).toBe(document.body)
  })

  it('ativar uma issue abre a aba indicada e foca o controle', async () => {
    renderForm()
    // A aba inicial é Essencial: o campo de preço nem está montado.
    expect(screen.queryByLabelText('Preço base (R$)')).toBeNull()
    await failPublish()

    fireEvent.click(within(summary() as HTMLElement).getByRole('button', { name: 'Informe o preço base antes de publicar.' }))

    const control = await screen.findByLabelText('Preço base (R$)')
    expect(control.id).toBe('product-base-price')
    await waitFor(() => expect(document.activeElement).toBe(control))
    // O erro do campo continua associado ao controle.
    expect(control.getAttribute('aria-invalid')).toBe('true')
    expect(control.getAttribute('aria-errormessage')).toBe('product-base-price-error')
  })

  it('issue sem destino mapeado permanece no resumo sem quebrar', async () => {
    renderForm()
    await failPublish()

    const region = summary() as HTMLElement
    const orphan = within(region).getByRole('button', { name: 'Revise o checklist de publicação.' })
    fireEvent.click(orphan)

    // A aba não muda (nenhuma das sete corresponde a `review`) e nada quebra.
    expect(screen.getByRole('navigation', { name: 'Seções de Edição rápida do rascunho' })).toBeTruthy()
    expect(within(region).getByRole('button', { name: 'Revise o checklist de publicação.' })).toBeTruthy()
  })

  it('o PublicationChecklist usa as issues recebidas', async () => {
    renderForm()
    expect(screen.queryByRole('region', { name: 'Checklist de publicação' })).toBeNull()
    await failPublish()

    const checklist = screen.getByRole('region', { name: 'Checklist de publicação' })
    expect(within(checklist).getByText('Bloqueios')).toBeTruthy()
    expect(within(checklist).getByRole('button', { name: 'Informe o preço base antes de publicar.' })).toBeTruthy()
    expect(within(checklist).getByText('Preencha o valor em reais.')).toBeTruthy()
  })

  it('mostra o checklist com as issues iniciais antes de qualquer operação', () => {
    renderForm({ initialPublicationIssues: [initialBlocker, initialWarning] })

    const panel = checklist()
    expect(within(panel).getByText('Bloqueios')).toBeTruthy()
    expect(within(panel).getByRole('button', { name: 'Adicione ao menos uma imagem antes de publicar.' })).toBeTruthy()
    expect(within(panel).getByText('Envie a foto principal da peça.')).toBeTruthy()
    expect(within(panel).getByText('Avisos')).toBeTruthy()
    expect(within(panel).getByRole('button', { name: 'Confirme o preço antes de publicar.' })).toBeTruthy()

    // Conteúdo informativo: nada de resumo focado, alerta de submissão ou fetch.
    expect(summary()).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(document.activeElement).toBe(document.body)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('apresenta o estado pronto quando o servidor não devolveu pendências', () => {
    renderForm({ initialPublicationIssues: [], publicationReady: true })
    expect(within(checklist()).getByText('Pronto para publicação')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('resposta estruturada posterior substitui as issues iniciais', async () => {
    renderForm({ initialPublicationIssues: [initialBlocker] })
    expect(within(checklist()).getByRole('button', { name: 'Adicione ao menos uma imagem antes de publicar.' })).toBeTruthy()

    await failPublish()

    expect(within(checklist()).getByRole('button', { name: 'Informe o preço base antes de publicar.' })).toBeTruthy()
    expect(within(checklist()).queryByRole('button', { name: 'Adicione ao menos uma imagem antes de publicar.' })).toBeNull()
    // A falha explícita mantém o comportamento de foco já implementado.
    await waitFor(() => expect(document.activeElement).toBe(summary()))
  })

  it('erro de transporte sem assessment novo não cria nem apaga issues', async () => {
    renderForm({ initialPublicationIssues: [initialBlocker] })

    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body ?? '{}')))
      return Promise.resolve(jsonResponse({ ok: false, error: { code: 'internal_error', summary: 'Falha inesperada.' } }, 500))
    })

    fireEvent.click(within(actionBar()).getByRole('button', { name: 'Salvar e publicar' }))
    await waitFor(() => expect(summary()).toBeTruthy())

    const panel = checklist()
    expect(within(panel).getByRole('button', { name: 'Adicione ao menos uma imagem antes de publicar.' })).toBeTruthy()
    expect(within(panel).getByText('1 verificação')).toBeTruthy()
  })

  it('a ActionBar reflete o dirty state real', () => {
    renderForm()
    const bar = actionBar()
    expect(within(bar).getByText('Rascunho sincronizado')).toBeTruthy()
    expect(within(bar).getByRole('button', { name: 'Salvar rascunho' }).hasAttribute('disabled')).toBe(true)

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Anel Solar II' } })
    expect(within(bar).getByText('Alterações não salvas')).toBeTruthy()
    expect(within(bar).getByRole('button', { name: 'Salvar rascunho' }).hasAttribute('disabled')).toBe(false)
  })

  it('salvar rascunho usa o callback existente', async () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Anel Solar II' } })
    fireEvent.click(within(actionBar()).getByRole('button', { name: 'Salvar rascunho' }))

    await waitFor(() => expect(bodies.length).toBeGreaterThan(0))
    expect(bodies[0].action).toBe('save-draft')
    await screen.findByText('Rascunho salvo')
  })

  it('erro ao salvar impede a chamada de publicação', async () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Anel Solar II' } })

    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body ?? '{}')))
      return Promise.resolve(jsonResponse({ ok: false, error: { code: 'internal_error', summary: 'Falha ao salvar.' } }, 500))
    })

    fireEvent.click(within(actionBar()).getByRole('button', { name: 'Salvar e publicar' }))
    await waitFor(() => expect(bodies.length).toBeGreaterThan(0))
    await screen.findByText('Falha ao salvar o rascunho.')

    expect(bodies.every((body) => body.action !== 'save-and-publish')).toBe(true)
  })

  it('publicar usa o callback existente', async () => {
    renderForm()
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body ?? '{}')))
      return Promise.resolve(publishedResponse())
    })

    fireEvent.click(within(actionBar()).getByRole('button', { name: 'Salvar e publicar' }))
    await waitFor(() => expect(bodies.some((body) => body.action === 'save-and-publish')).toBe(true))
    await screen.findByText('Produto publicado.')
    expect(refresh).toHaveBeenCalled()
  })

  it('o estado de carregamento impede submissão duplicada', async () => {
    renderForm()
    let release = () => {}
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body ?? '{}')))
      return new Promise<Response>((resolve) => {
        release = () => resolve(publishedResponse())
      })
    })

    const publishButton = within(actionBar()).getByRole('button', { name: 'Salvar e publicar' })
    fireEvent.click(publishButton)

    await waitFor(() => expect(publishButton.hasAttribute('disabled')).toBe(true))
    expect(within(actionBar()).getByRole('button', { name: 'Salvar rascunho' }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(publishButton)
    expect(bodies.filter((body) => body.action === 'save-and-publish')).toHaveLength(1)

    release()
    await screen.findByText('Produto publicado.')
  })

  it('o feedback de salvamento não é apresentado como confirmação do site', async () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Anel Solar II' } })
    fireEvent.click(within(actionBar()).getByRole('button', { name: 'Salvar rascunho' }))

    const saved = await screen.findByText('Rascunho salvo')
    expect(saved.closest('.esmera-product-draft-form__save-feedback')).toBeTruthy()
    expect(screen.queryByText('Produto publicado.')).toBeNull()
    expect(document.querySelector('.esmera-product-publication-feedback')?.textContent).toBe('')
  })
})
