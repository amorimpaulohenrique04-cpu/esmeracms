/* eslint-disable react-hooks/error-boundaries -- Query failures are handled here; render failures remain handled by the Next.js/Payload boundaries. */
import type { AdminViewServerProps } from 'payload'

import {
  AccessDenied,
  EmptyState,
  ensureUser,
  findDocs,
  PageHeader,
  QueryError,
  shortDate,
  TechnicalLink,
  ViewFrame,
} from '../../views/shared'

type Customer = {
  id: string | number
  name?: string
  phone?: string
  email?: string
  city?: string
  state?: string
  updatedAt?: string
}

export async function CustomersView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'business')
  if (!allowed) return <AccessDenied props={props} area="comercial" />

  try {
    const result = await findDocs<Customer>(props.initPageResult.req, 'customers', {
      sort: '-updatedAt',
      limit: 100,
      depth: 0,
      select: { id: true, name: true, phone: true, email: true, city: true, state: true, updatedAt: true },
    })

    return <ViewFrame props={props}>
      <PageHeader eyebrow="Business" title="Clientes" subtitle="Relacionamento, preferências e histórico comercial em uma fonte autenticada." actions={<TechnicalLink href="/admin/collections/customers/create" primary>Novo cliente</TechnicalLink>} />
      <section className="esmera-card"><div className="esmera-card-header"><h2>Base de clientes</h2><span className="esmera-pill esmera-pill--green">{result.totalDocs} clientes</span></div>{result.docs.length ? <ul className="esmera-list">{result.docs.map((customer) => <li className="esmera-list-row" key={String(customer.id)}><div><a className="esmera-row-title" href={`/admin/collections/customers/${customer.id}`}>{customer.name || 'Cliente sem nome'}</a><span className="esmera-row-meta">{customer.phone || customer.email || 'Sem contato'} · {[customer.city, customer.state].filter(Boolean).join(' / ') || 'Local não informado'}</span></div><span className="esmera-pill">{shortDate(customer.updatedAt)}</span></li>)}</ul> : <EmptyState title="Nenhum cliente" copy="A consulta foi concluída e a base ainda está vazia." />}</section>
    </ViewFrame>
  } catch (error) {
    return <ViewFrame props={props}><PageHeader title="Clientes" subtitle="Business" /><QueryError title="Não foi possível consultar clientes" error={error} /></ViewFrame>
  }
}
