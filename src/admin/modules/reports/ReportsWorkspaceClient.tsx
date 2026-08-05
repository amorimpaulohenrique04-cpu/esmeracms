'use client'

import { Drawer } from '@base-ui/react/drawer'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import React, { useMemo, useState } from 'react'

import { opportunityStageLabels } from '../../../businessRules/opportunities/stages'
import type {
  NormalizedReportingFilters,
  ReportingDrilldown,
  ReportingDrilldownKind,
  ReportingSnapshot,
} from '../../../server/reporting'
import { DataTable, DateField, EmptyState } from '../../design-system'
import { commercialEvolutionOption, type EvolutionMode } from './charts'
import { EChart } from './EChart'

type OptionItem = { id: string | number; label: string }

type Props = {
  initialData: ReportingSnapshot
  users: OptionItem[]
  products: OptionItem[]
  categories: OptionItem[]
}

type DraftFilters = {
  from: string
  to: string
  compareWith: '' | 'previous_period' | 'previous_year'
  owner: string
  source: string
  category: string
  product: string
}

type DrilldownRequest = {
  kind: ReportingDrilldownKind
  value: string | null
}

const sourceLabels: Record<string, string> = {
  instagram: 'Instagram',
  referral: 'Indicação',
  site: 'Site',
  architect: 'Arquiteto',
  organic: 'Orgânico',
  whatsapp: 'WhatsApp',
  other: 'Outro',
  unattributed: 'Não atribuída',
}

function dateInputValue(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Recife',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function dateBoundary(value: string, end = false) {
  const suffix = end ? '23:59:59.999' : '00:00:00.000'
  return new Date(`${value}T${suffix}-03:00`).toISOString()
}

function defaultPeriod() {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Recife',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  return {
    from: new Date(Date.UTC(year, month - 1, 1, 3, 0, 0, 0)).toISOString(),
    to: now.toISOString(),
  }
}

function draftFrom(filters: NormalizedReportingFilters): DraftFilters {
  return {
    from: dateInputValue(filters.period.from),
    to: dateInputValue(filters.period.to),
    compareWith: filters.compareWith || '',
    owner: filters.ownerId === null ? '' : String(filters.ownerId),
    source: filters.source || '',
    category: filters.categoryId === null ? '' : String(filters.categoryId),
    product: filters.productId === null ? '' : String(filters.productId),
  }
}

function filtersFromDraft(draft: DraftFilters): NormalizedReportingFilters {
  return {
    period: {
      from: dateBoundary(draft.from),
      to: dateBoundary(draft.to, true),
    },
    compareWith: draft.compareWith || null,
    ownerId: draft.owner || null,
    source: draft.source || null,
    categoryId: draft.category || null,
    productId: draft.product || null,
  }
}

function searchParams(filters: NormalizedReportingFilters) {
  const params = new URLSearchParams()
  params.set('from', filters.period.from)
  params.set('to', filters.period.to)
  if (filters.compareWith) params.set('compareWith', filters.compareWith)
  if (filters.ownerId !== null) params.set('owner', String(filters.ownerId))
  if (filters.source) params.set('source', filters.source)
  if (filters.categoryId !== null) params.set('category', String(filters.categoryId))
  if (filters.productId !== null) params.set('product', String(filters.productId))
  return params
}

async function fetchReport(filters: NormalizedReportingFilters) {
  const response = await fetch(`/api/admin-reports?${searchParams(filters).toString()}`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
  const body = await response.json() as ReportingSnapshot & { error?: string }
  if (!response.ok) throw new Error(body.error || 'Não foi possível atualizar os relatórios.')
  return body
}

async function fetchDrilldown(filters: NormalizedReportingFilters, request: DrilldownRequest) {
  const params = searchParams(filters)
  params.set('mode', 'drilldown')
  params.set('kind', request.kind)
  if (request.value) params.set('value', request.value)
  const response = await fetch(`/api/admin-reports?${params.toString()}`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
  const body = await response.json() as ReportingDrilldown & { error?: string }
  if (!response.ok) throw new Error(body.error || 'Não foi possível abrir os registros.')
  return body
}

function money(cents: number | null | undefined) {
  if (typeof cents !== 'number') return '—'
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function percent(value: number | null | undefined) {
  if (typeof value !== 'number') return '—'
  return value.toLocaleString('pt-BR', { style: 'percent', maximumFractionDigits: 1 })
}

function days(value: number | null | undefined) {
  if (typeof value !== 'number') return '—'
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`
}

function shortDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function delta(value: number | null, format: 'number' | 'percent' | 'money' | 'days' = 'number') {
  if (value === null) return 'Sem comparação'
  const prefix = value > 0 ? '+' : ''
  if (format === 'percent') return `${prefix}${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.`
  if (format === 'money') return `${prefix}${money(value)}`
  if (format === 'days') return `${prefix}${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`
  return `${prefix}${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}`
}

function FilterBar({ draft, setDraft, users, products, categories, onApply, onClear, onShare, shareFeedback }: {
  draft: DraftFilters
  setDraft: React.Dispatch<React.SetStateAction<DraftFilters>>
  users: OptionItem[]
  products: OptionItem[]
  categories: OptionItem[]
  onApply: () => void
  onClear: () => void
  onShare: () => void
  shareFeedback: string
}) {
  const advancedActive = Boolean(draft.owner || draft.source || draft.category || draft.product)

  return (
    <form className="esmera-report-filters" onSubmit={(event) => { event.preventDefault(); onApply() }}>
      <div className="esmera-report-filter-primary">
        <div className="esmera-report-filter-period">
          <DateField label="De" required value={draft.from} onChange={(from) => setDraft((current) => ({ ...current, from }))} />
          <DateField label="Até" required value={draft.to} onChange={(to) => setDraft((current) => ({ ...current, to }))} />
          <label><span>Comparar com</span><select className="esmera-input" value={draft.compareWith} onChange={(event) => setDraft((current) => ({ ...current, compareWith: event.target.value as DraftFilters['compareWith'] }))}><option value="">Sem comparação</option><option value="previous_period">Período anterior</option><option value="previous_year">Mesmo período no ano anterior</option></select></label>
        </div>
        <button className="esmera-button esmera-button--primary" type="submit">Aplicar período</button>
      </div>
      <details className="esmera-report-filter-advanced" open={advancedActive || undefined}>
        <summary>Dimensões e ações{advancedActive ? ' · filtros ativos' : ''}</summary>
        <div className="esmera-report-filter-advanced__panel">
          <div className="esmera-report-filter-dimensions">
            <label><span>Responsável</span><select className="esmera-input" value={draft.owner} onChange={(event) => setDraft((current) => ({ ...current, owner: event.target.value }))}><option value="">Todos</option>{users.map((item) => <option key={String(item.id)} value={String(item.id)}>{item.label}</option>)}</select></label>
            <label><span>Origem</span><select className="esmera-input" value={draft.source} onChange={(event) => setDraft((current) => ({ ...current, source: event.target.value }))}><option value="">Todas</option>{Object.entries(sourceLabels).filter(([value]) => value !== 'unattributed').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>Categoria</span><select className="esmera-input" value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}><option value="">Todas</option>{categories.map((item) => <option key={String(item.id)} value={String(item.id)}>{item.label}</option>)}</select></label>
            <label><span>Produto</span><select className="esmera-input" value={draft.product} onChange={(event) => setDraft((current) => ({ ...current, product: event.target.value }))}><option value="">Todos</option>{products.map((item) => <option key={String(item.id)} value={String(item.id)}>{item.label}</option>)}</select></label>
          </div>
          <div className="esmera-report-filter-actions">
            <button className="esmera-button esmera-button--primary" type="submit">Aplicar recorte</button>
            <button className="esmera-button esmera-button--quiet" type="button" onClick={onClear}>Limpar</button>
            <button className="esmera-button" type="button" onClick={onShare}>Compartilhar</button>
            <span role="status" aria-live="polite">{shareFeedback}</span>
          </div>
        </div>
      </details>
    </form>
  )
}

function DrilldownDrawer({ request, result, loading, error, onClose }: {
  request: DrilldownRequest | null
  result: ReportingDrilldown | undefined
  loading: boolean
  error: Error | null
  onClose: () => void
}) {
  return (
    <Drawer.Root open={Boolean(request)} onOpenChange={(open) => { if (!open) onClose() }} swipeDirection="right">
      <Drawer.Portal>
        <Drawer.Backdrop className="esmera-overlay-backdrop" />
        <Drawer.Viewport className="esmera-drawer-viewport">
          <Drawer.Popup className="esmera-drawer esmera-report-drawer">
            <Drawer.Content>
              <div className="esmera-overlay-header">
                <div><Drawer.Title>{result?.title || 'Registros'}</Drawer.Title><Drawer.Description>{result?.description || 'Carregando registros reais do período.'}</Drawer.Description></div>
                <Drawer.Close className="esmera-icon-button" aria-label="Fechar">×</Drawer.Close>
              </div>
              <div className="esmera-overlay-body">
                {loading ? <div className="esmera-report-drilldown-loading"><span /><span /><span /></div> : null}
                {error ? <div className="esmera-state esmera-state--error"><strong>Não foi possível abrir os registros</strong><p>{error.message}</p></div> : null}
                {!loading && !error && result?.records.length ? <ul className="esmera-report-records">{result.records.map((record) => <li key={record.key}><div><strong>{record.title}</strong><span>{record.meta}</span><small>{record.status} · {shortDate(record.occurredAt)}{record.amountCents !== null ? ` · ${money(record.amountCents)}` : ''}</small></div><Link className="esmera-button" href={record.href}>Abrir registro</Link></li>)}</ul> : null}
                {!loading && !error && result && !result.records.length ? <EmptyState title="Nenhum registro" copy="A consulta foi concluída e não encontrou documentos para este recorte." /> : null}
                {result?.truncated ? <p className="esmera-report-drawer-note">Mostrando os 100 registros mais recentes deste recorte.</p> : null}
              </div>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

function Kpi({ label, value, meta, empty, onClick }: { label: string; value: string; meta: string; empty?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick}><span>{label}</span><strong>{value}</strong><small className={empty ? 'is-empty' : ''}>{empty ? `Sem base · ${meta}` : meta}</small></button>
}

function WorkspaceInner({ initialData, users, products, categories }: Props) {
  const [activeFilters, setActiveFilters] = useState(initialData.filters)
  const [draft, setDraft] = useState<DraftFilters>(() => draftFrom(initialData.filters))
  const [shareFeedback, setShareFeedback] = useState('')
  const [evolutionMode, setEvolutionMode] = useState<EvolutionMode>('volume')
  const [catalogMode, setCatalogMode] = useState<'products' | 'categories'>('products')
  const [drilldownRequest, setDrilldownRequest] = useState<DrilldownRequest | null>(null)

  const reportQuery = useQuery({
    queryKey: ['reports', activeFilters],
    queryFn: () => fetchReport(activeFilters),
    initialData: activeFilters === initialData.filters ? initialData : undefined,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  const drilldownQuery = useQuery({
    queryKey: ['reports', 'drilldown', activeFilters, drilldownRequest],
    queryFn: () => fetchDrilldown(activeFilters, drilldownRequest as DrilldownRequest),
    enabled: Boolean(drilldownRequest),
    staleTime: 30_000,
    retry: 1,
  })

  const data = reportQuery.data || initialData
  const metrics = data.metrics.current
  const deltaMetrics = data.metrics.delta
  const chartOption = useMemo(() => commercialEvolutionOption(data.evolution, evolutionMode), [data.evolution, evolutionMode])
  const catalogRows = catalogMode === 'products' ? data.products : data.categories
  const hasEvolutionData = data.evolution.current.some((point) => point.leads > 0 || point.opportunities > 0 || point.sales > 0 || point.revenueCents > 0)
  const hasLosses = data.losses.length > 0
  const hasSources = data.sources.length > 0
  const hasTeam = data.team.length > 0
  const hasSecondaryAnalysis = hasLosses || hasSources || hasTeam

  function navigate(next: NormalizedReportingFilters) {
    setActiveFilters(next)
    setDraft(draftFrom(next))
    window.history.replaceState(window.history.state, '', `/admin/reports?${searchParams(next).toString()}`)
  }

  function applyFilters() { navigate(filtersFromDraft(draft)) }

  function clearFilters() {
    const period = defaultPeriod()
    navigate({ period, compareWith: null, ownerId: null, source: null, categoryId: null, productId: null })
  }

  async function share() {
    const exactURL = `${window.location.origin}/admin/reports?${searchParams(activeFilters).toString()}`
    try {
      await navigator.clipboard.writeText(exactURL)
      setShareFeedback('URL exata copiada.')
    } catch {
      setShareFeedback('Não foi possível copiar automaticamente.')
    }
  }

  function patchFilters(patch: Partial<NormalizedReportingFilters>) { navigate({ ...activeFilters, ...patch }) }
  function openDrilldown(kind: ReportingDrilldownKind, value: string | number | null = null) { setDrilldownRequest({ kind, value: value === null ? null : String(value) }) }

  return (
    <div className={`esmera-report-workspace${reportQuery.isFetching ? ' is-refreshing' : ''}`} data-testid="reports-workspace">
      <FilterBar draft={draft} setDraft={setDraft} users={users} products={products} categories={categories} onApply={applyFilters} onClear={clearFilters} onShare={() => void share()} shareFeedback={shareFeedback} />

      <div className="esmera-report-refresh" aria-live="polite">{reportQuery.isFetching ? 'Atualizando dados sem ocultar o período anterior…' : `Atualizado em ${new Date(data.generatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}</div>
      {reportQuery.error ? <div className="esmera-state esmera-state--error"><strong>Não foi possível atualizar os relatórios</strong><p>{reportQuery.error.message}</p><small>Os últimos dados válidos continuam visíveis.</small></div> : null}

      <section className="esmera-report-kpis" aria-label="Indicadores comerciais">
        <Kpi label="Oportunidades" value={metrics.opportunitiesCreated.toLocaleString('pt-BR')} meta={delta(deltaMetrics.opportunitiesCreated.absolute)} onClick={() => openDrilldown('opportunities')} />
        <Kpi label="Conversão" value={percent(metrics.conversionRate)} meta={metrics.conversionRate === null ? 'Nenhuma oportunidade concluída no período' : delta(deltaMetrics.conversionRate.absolute, 'percent')} empty={metrics.conversionRate === null} onClick={() => openDrilldown('conversion')} />
        <Kpi label="Ticket médio" value={money(metrics.averageTicketCents)} meta={metrics.averageTicketCents === null ? 'Nenhuma venda confirmada no período' : delta(deltaMetrics.averageTicketCents.absolute, 'money')} empty={metrics.averageTicketCents === null} onClick={() => openDrilldown('sales')} />
        <Kpi label="Ciclo de venda" value={days(metrics.averageSalesCycleDays)} meta={metrics.averageSalesCycleDays === null ? 'Nenhuma venda concluída com ciclo mensurável' : delta(deltaMetrics.averageSalesCycleDays.absolute, 'days')} empty={metrics.averageSalesCycleDays === null} onClick={() => openDrilldown('cycle')} />
      </section>

      <section className="esmera-report-section esmera-report-evolution">
        <div className="esmera-report-section__header"><div><span className="esmera-eyebrow">Evolução comercial</span><h2>Movimento no período</h2><p>Leads, oportunidades, vendas e receita com a comparação selecionada.</p></div><div className="esmera-report-segmented" aria-label="Métrica do gráfico"><button type="button" className={evolutionMode === 'volume' ? 'is-active' : ''} onClick={() => setEvolutionMode('volume')}>Volume</button><button type="button" className={evolutionMode === 'revenue' ? 'is-active' : ''} onClick={() => setEvolutionMode('revenue')}>Receita</button></div></div>
        {hasEvolutionData ? <EChart option={chartOption} ariaLabel={evolutionMode === 'volume' ? 'Evolução diária de leads, oportunidades e vendas' : 'Evolução diária da receita'} height={300} /> : <div className="esmera-report-empty-visualization"><strong>Sem movimento no período</strong><p>Nenhum lead, oportunidade, venda ou receita foi confirmado neste recorte. Ajuste o período ou as dimensões para investigar outra base.</p></div>}
      </section>

      <section className="esmera-report-section">
        <div className="esmera-report-section__header"><div><span className="esmera-eyebrow">Funil</span><h2>Progressão por etapa</h2><p>Volume alcançado, avanço e perda calculados pelo histórico real de Activities.</p></div><div className="esmera-report-terminal"><span>Conversão final</span><strong>{percent(data.funnel.terminalConversionRate)}</strong></div></div>
        <div className="esmera-report-funnel" aria-label="Etapas do funil comercial">{data.funnel.stages.map((stage) => <button type="button" key={stage.stage} onClick={() => openDrilldown('funnel-stage', stage.stage)}><span>{opportunityStageLabels[stage.stage]}</span><strong>{stage.volume}</strong><dl><div><dt>Avanço</dt><dd>{stage.stage === 'won' ? 'Final' : percent(stage.conversionToNext)}</dd></div><div><dt>Drop-off</dt><dd>{stage.dropOff} · {percent(stage.dropOffRate)}</dd></div></dl></button>)}</div>
      </section>

      {hasLosses || hasSources ? <div className="esmera-report-two-column">
        {hasLosses ? <section className="esmera-report-section"><div className="esmera-report-section__header"><div><span className="esmera-eyebrow">Perdas</span><h2>Motivos registrados</h2><p>Ranking das razões estruturadas de perda.</p></div></div><div className="esmera-report-ranking">{data.losses.map((loss) => <button type="button" key={loss.reason} onClick={() => openDrilldown('loss-reason', loss.reason)}><div><span>{loss.label}</span><strong>{loss.volume}</strong></div><div className="esmera-report-ranking__track"><span style={{ width: `${Math.max(2, (loss.shareOfLosses || 0) * 100)}%` }} /></div><small>{percent(loss.shareOfLosses)}</small></button>)}</div></section> : null}
        {hasSources ? <section className="esmera-report-section"><div className="esmera-report-section__header"><div><span className="esmera-eyebrow">Origem</span><h2>Qualidade da aquisição</h2><p>Volume, conversão e receita atribuída por origem.</p></div></div><DataTable label="Performance por origem"><thead><tr><th>Origem</th><th>Volume</th><th>Conversão</th><th>Receita</th><th /></tr></thead><tbody>{data.sources.map((source) => <tr key={source.source}><td><button className="esmera-report-text-action" type="button" onClick={() => patchFilters({ source: source.source === 'unattributed' ? null : source.source })}>{sourceLabels[source.source] || source.source}</button></td><td>{source.opportunitiesCreated}</td><td>{percent(source.conversionRate)}</td><td>{money(source.revenueCents)}</td><td><button className="esmera-button esmera-button--quiet" type="button" onClick={() => openDrilldown('source', source.source)}>Registros</button></td></tr>)}</tbody></DataTable></section> : null}
      </div> : null}

      {!hasSecondaryAnalysis ? <section className="esmera-report-availability-summary"><div><span className="esmera-eyebrow">Disponibilidade analítica</span><h2>Sem perdas, origens ou responsáveis mensuráveis</h2></div><p>O sistema consultou as três dimensões e não encontrou base real no período. Elas voltarão a ocupar superfícies analíticas quando houver registros válidos.</p></section> : null}

      <section className="esmera-report-section">
        <div className="esmera-report-section__header"><div><span className="esmera-eyebrow">Catálogo</span><h2>Produtos e categorias</h2><p>Volume comercial, conversão e receita bruta por item vendido.</p></div><div className="esmera-report-segmented" aria-label="Segmentação do catálogo"><button type="button" className={catalogMode === 'products' ? 'is-active' : ''} onClick={() => setCatalogMode('products')}>Produtos</button><button type="button" className={catalogMode === 'categories' ? 'is-active' : ''} onClick={() => setCatalogMode('categories')}>Categorias</button></div></div>
        {catalogRows.length ? <DataTable label={catalogMode === 'products' ? 'Performance de produtos' : 'Performance de categorias'}><thead><tr><th>{catalogMode === 'products' ? 'Produto' : 'Categoria'}</th><th>Oportunidades</th><th>Conversão</th><th>Vendas</th><th>Receita bruta</th><th /></tr></thead><tbody>{catalogRows.slice(0, 20).map((row) => { const id = catalogMode === 'products' ? 'productId' in row ? row.productId : 0 : 'categoryId' in row ? row.categoryId : 0; return <tr key={`${catalogMode}:${id}`}><td><button className="esmera-report-text-action" type="button" onClick={() => catalogMode === 'products' ? patchFilters({ productId: id }) : patchFilters({ categoryId: id })}>{row.title}</button></td><td>{row.opportunitiesCreated}</td><td>{percent(row.conversionRate)}</td><td>{row.validSales}</td><td>{money(row.grossItemRevenueCents)}</td><td><button className="esmera-button esmera-button--quiet" type="button" onClick={() => openDrilldown(catalogMode === 'products' ? 'product' : 'category', id)}>Registros</button></td></tr> })}</tbody></DataTable> : <EmptyState title="Sem desempenho de catálogo" copy="Nenhum produto ou categoria corresponde ao período e aos filtros." />}
        <p className="esmera-report-note">{catalogMode === 'products' ? data.notes.productRevenue : data.notes.categoryOverlap}</p>
      </section>

      {hasTeam ? <section className="esmera-report-section"><div className="esmera-report-section__header"><div><span className="esmera-eyebrow">Equipe</span><h2>Performance por responsável</h2><p>Oportunidades, conversão, vendas e receita sem ranking decorativo.</p></div></div><DataTable label="Performance por responsável"><thead><tr><th>Responsável</th><th>Oportunidades</th><th>Conversão</th><th>Vendas</th><th>Receita</th><th>Ticket</th><th /></tr></thead><tbody>{data.team.map((member) => <tr key={String(member.ownerId ?? 'unassigned')}><td>{member.ownerId === null ? member.ownerName : <button className="esmera-report-text-action" type="button" onClick={() => patchFilters({ ownerId: member.ownerId })}>{member.ownerName}</button>}</td><td>{member.opportunitiesCreated}</td><td>{percent(member.conversionRate)}</td><td>{member.validSales}</td><td>{money(member.revenueCents)}</td><td>{money(member.averageTicketCents)}</td><td>{member.ownerId !== null ? <button className="esmera-button esmera-button--quiet" type="button" onClick={() => openDrilldown('owner', member.ownerId)}>Registros</button> : null}</td></tr>)}</tbody></DataTable></section> : null}

      <footer className="esmera-report-contract"><strong>Contrato {data.semanticVersion}</strong><span>{shortDate(activeFilters.period.from)} — {shortDate(activeFilters.period.to)}</span><span>Cutover do funil: {shortDate(data.opportunityCutoverAt)}</span><span>Fonte: Payload/PostgreSQL</span><span>Nenhum percentual é fixo.</span></footer>
      <DrilldownDrawer request={drilldownRequest} result={drilldownQuery.data} loading={drilldownQuery.isFetching} error={drilldownQuery.error} onClose={() => setDrilldownRequest(null)} />
    </div>
  )
}

export function ReportsWorkspaceClient(props: Props) {
  return <WorkspaceInner {...props} />
}
