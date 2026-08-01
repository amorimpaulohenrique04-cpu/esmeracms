/* eslint-disable react-hooks/error-boundaries -- Query failures are rendered as explicit operational errors. */
import Link from 'next/link'
import type { AdminViewServerProps, Where } from 'payload'

import { DataTable, EmptyState, Status } from '../../design-system'
import {
  AccessDenied,
  dateTime,
  ensureUser,
  findDocs,
  PageHeader,
  QueryError,
  ViewFrame,
} from '../../views/shared'
import { PrivacyActions } from './PrivacyActions'

type PrivacyCustomer = {
  id: string | number
  name?: string | null
  company?: string | null
  email?: string | null
  phone?: string | null
  marketingConsent?: boolean | null
  consentRecordedAt?: string | null
  consentWithdrawnAt?: string | null
  privacyRequestStatus?: string | null
  privacyRequestAt?: string | null
  privacyRequestCompletedAt?: string | null
  retentionReviewAt?: string | null
  processingRestricted?: boolean | null
  updatedAt?: string | null
}

type PrivacyFilters = {
  q: string
  consent: 'all' | 'granted' | 'withdrawn'
  request: 'all' | 'none' | 'requested' | 'reviewing' | 'blocked' | 'completed'
  page: number
}

const requestLabels: Record<string, string> = {
  none: 'Nenhuma',
  requested: 'Solicitada',
  reviewing: 'Em análise',
  blocked: 'Bloqueada',
  completed: 'Concluída',
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

async function searchParamsOf(props: AdminViewServerProps) {
  return await Promise.resolve(props.searchParams as unknown as Record<string, string | string[] | undefined>)
}

function filtersFrom(params: Record<string, string | string[] | undefined>): PrivacyFilters {
  const consent = first(params.consent)
  const request = first(params.request)
  const page = Number(first(params.page) || 1)
  return {
    q: (first(params.q) || '').trim().slice(0, 120),
    consent: consent === 'granted' || consent === 'withdrawn' ? consent : 'all',
    request: ['none', 'requested', 'reviewing', 'blocked', 'completed'].includes(request || '') ? request as PrivacyFilters['request'] : 'all',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

function whereFrom(filters: PrivacyFilters): Where {
  const and: Where[] = []
  if (filters.q) {
    and.push({ or: [
      { name: { like: filters.q } },
      { company: { like: filters.q } },
      { email: { like: filters.q } },
      { phone: { like: filters.q } },
    ] } as Where)
  }
  if (filters.consent === 'granted') and.push({ marketingConsent: { equals: true } } as Where)
  if (filters.consent === 'withdrawn') and.push({ marketingConsent: { equals: false } } as Where)
  if (filters.request !== 'all') and.push({ privacyRequestStatus: { equals: filters.request } } as Where)
  return and.length ? { and } as Where : {}
}

function href(filters: PrivacyFilters, patch: Partial<PrivacyFilters>) {
  const next = { ...filters, ...patch }
  const params = new URLSearchParams()
  if (next.q) params.set('q', next.q)
  if (next.consent !== 'all') params.set('consent', next.consent)
  if (next.request !== 'all') params.set('request', next.request)
  if (next.page > 1) params.set('page', String(next.page))
  const query = params.toString()
  return query ? `/admin/privacy?${query}` : '/admin/privacy'
}

function requestTone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (status === 'completed') return 'success'
  if (status === 'blocked') return 'danger'
  if (status === 'requested' || status === 'reviewing') return 'warning'
  return 'neutral'
}

export async function PrivacyView(props: AdminViewServerProps) {
  const { allowed, role } = ensureUser(props, 'business')
  if (!allowed) return <AccessDenied props={props} area="de privacidade" />

  const params = await searchParamsOf(props)
  const filters = filtersFrom(params)
  const req = props.initPageResult.req

  try {
    const result = await findDocs<PrivacyCustomer>(req, 'customers', {
      sort: '-updatedAt',
      limit: 50,
      page: filters.page,
      depth: 0,
      where: whereFrom(filters),
      select: {
        id: true,
        name: true,
        company: true,
        email: true,
        phone: true,
        marketingConsent: true,
        consentRecordedAt: true,
        consentWithdrawnAt: true,
        privacyRequestStatus: true,
        privacyRequestAt: true,
        privacyRequestCompletedAt: true,
        retentionReviewAt: true,
        processingRestricted: true,
        updatedAt: true,
      },
    })

    return (
      <ViewFrame props={props}>
        <PageHeader
          eyebrow="LGPD"
          title="Privacidade"
          subtitle="Consentimento, portabilidade, retificação, restrição, solicitações e anonimização operados sobre o registro real do cliente."
        />

        <div className="esmera-state">
          <strong>Sem inferência de dados sensíveis</strong>
          <p>Esta área registra apenas consentimento declarado e solicitações verificáveis. Anonimização exige papel de administrador e é bloqueada enquanto houver obrigações operacionais abertas.</p>
        </div>

        <form className="esmera-filter-bar" method="get" action="/admin/privacy">
          <label className="esmera-field"><span className="esmera-field-label">Buscar</span><input className="esmera-input" type="search" name="q" defaultValue={filters.q} placeholder="Nome, empresa, e-mail ou telefone" /></label>
          <label className="esmera-field"><span className="esmera-field-label">Consentimento</span><select className="esmera-input" name="consent" defaultValue={filters.consent}><option value="all">Todos</option><option value="granted">Concedido</option><option value="withdrawn">Não concedido/retirado</option></select></label>
          <label className="esmera-field"><span className="esmera-field-label">Solicitação</span><select className="esmera-input" name="request" defaultValue={filters.request}><option value="all">Todas</option>{Object.entries(requestLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button className="esmera-button esmera-button--primary" type="submit">Aplicar</button>
          <Link className="esmera-button esmera-button--quiet" href="/admin/privacy">Limpar</Link>
        </form>

        {!result.docs.length ? <EmptyState title="Nenhum registro de privacidade encontrado" copy="Ajuste os filtros ou confirme se existem clientes acessíveis ao seu papel." /> : (
          <DataTable label="Operações de privacidade dos clientes">
            <thead><tr><th>Cliente</th><th>Consentimento</th><th>Solicitação</th><th>Retenção</th><th>Atualizado</th><th>Ações</th></tr></thead>
            <tbody>{result.docs.map((customer) => {
              const requestStatus = customer.privacyRequestStatus || 'none'
              return <tr key={String(customer.id)}>
                <td><strong>{customer.name || 'Cliente sem nome'}</strong><br /><small>{customer.company || customer.email || customer.phone || 'Sem contato complementar'}</small></td>
                <td><Status tone={customer.marketingConsent ? 'success' : 'neutral'}>{customer.marketingConsent ? 'Concedido' : 'Não concedido'}</Status><br /><small>{customer.marketingConsent ? dateTime(customer.consentRecordedAt) : customer.consentWithdrawnAt ? `Retirado ${dateTime(customer.consentWithdrawnAt)}` : 'Sem registro de concessão'}</small></td>
                <td><Status tone={requestTone(requestStatus)}>{requestLabels[requestStatus] || requestStatus}</Status><br /><small>{dateTime(customer.privacyRequestAt)}</small>{customer.processingRestricted ? <><br /><small>Tratamento restrito</small></> : null}</td>
                <td>{dateTime(customer.retentionReviewAt)}</td>
                <td>{dateTime(customer.updatedAt)}</td>
                <td><PrivacyActions customerId={customer.id} consent={customer.marketingConsent === true} requestStatus={requestStatus} isAdmin={role === 'admin'} /></td>
              </tr>
            })}</tbody>
          </DataTable>
        )}

        {result.totalPages > 1 ? <nav className="esmera-pagination" aria-label="Paginação de privacidade"><Link className="esmera-button" aria-disabled={filters.page <= 1} href={href(filters, { page: Math.max(1, filters.page - 1) })}>Anterior</Link><span>Página {filters.page} de {result.totalPages}</span><Link className="esmera-button" aria-disabled={filters.page >= result.totalPages} href={href(filters, { page: Math.min(result.totalPages, filters.page + 1) })}>Próxima</Link></nav> : null}
      </ViewFrame>
    )
  } catch (error) {
    return <ViewFrame props={props}><PageHeader title="Privacidade" subtitle="Operações LGPD" /><QueryError title="Não foi possível carregar os registros de privacidade" error={error} /></ViewFrame>
  }
}
