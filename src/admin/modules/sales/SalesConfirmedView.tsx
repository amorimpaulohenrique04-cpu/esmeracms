/* eslint-disable react-hooks/error-boundaries -- Query failures are handled here; render failures remain handled by the Next.js/Payload boundaries. */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps, Where } from 'payload'

import { eligibleSaleStatuses } from '../../../collections/Sales'
import { DataTable, EmptyState, FunnelStepper, Status } from '../../design-system'
import {
  AccessDenied,
  ensureUser,
  findDocs,
  PageHeader,
  QueryError,
  ViewFrame,
} from '../../views/shared'
import { relationLabel, saleStatusLabels, type SalesTransaction } from './types'

type CustomerID = { id: string | number }

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function money(cents: number | null | undefined) {
  if (typeof cents !== 'number') return '—'
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function shortDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function paramsOf(props: AdminViewServerProps) {
  return await Promise.resolve(props.searchParams as unknown as Record<string, string | string[] | undefined>)
}

export async function SalesConfirmedView(props: AdminViewServerProps) {
  const params = await paramsOf(props)
  const view = first(params.view)
  if (view) {
    const search = new URLSearchParams(params as Record<string, string>)
    redirect(`/admin/opportunities?${search.toString()}`)
  }

  const { allowed } = ensureUser(props, 'business')
  if (!allowed) return <AccessDenied props={props} area="comercial" />

  const req = props.initPageResult.req
  const q = (first(params.q) || '').trim().slice(0, 120)

  try {
    let matchingCustomers: CustomerID[] = []
    if (q) {
      const result = await findDocs<CustomerID>(req, 'customers', {
        depth: 0,
        limit: 200,
        where: { or: [{ name: { like: q } }, { company: { like: q } }] } as Where,
        select: { id: true },
      })
      matchingCustomers = result.docs
    }

    const where: Where = {
      and: [
        { status: { in: [...eligibleSaleStatuses] } } as Where,
        ...(q ? [{ or: [{ number: { like: q } }, ...(matchingCustomers.length ? [{ customer: { in: matchingCustomers.map((item) => item.id) } }] : [])] } as Where] : []),
      ],
    }

    const salesResult = await findDocs<SalesTransaction>(req, 'sales', {
      sort: '-confirmedAt',
      limit: 200,
      depth: 1,
      where,
      select: { id: true, number: true, status: true, totalCents: true, customer: true, opportunity: true, confirmedAt: true, expectedDeliveryAt: true, updatedAt: true },
    })

    return <ViewFrame props={props} width="fluid">
      <PageHeader
        eyebrow="Passo 3 do funil"
        title="Vendas"
        subtitle="Vendas confirmadas, nascidas de oportunidades ganhas. Acompanhe produção e entrega aqui."
        actions={<><Link className="esmera-button esmera-button--primary" href="/admin/opportunities?view=pipeline">Ver oportunidades</Link><Link className="esmera-button" href="/admin/after-sales">Registrar acompanhamento</Link></>}
      />
      <FunnelStepper current={3} />
      {salesResult.docs.length ? (
        <div className="esmera-data-table-wrap">
          <DataTable label="Vendas confirmadas">
            <thead><tr><th>Venda</th><th>Cliente</th><th>Status</th><th>Total</th><th>Confirmada</th><th>Entrega prevista</th><th /></tr></thead>
            <tbody>
              {salesResult.docs.map((sale) => (
                <tr key={String(sale.id)}>
                  <td><strong>{sale.number || sale.id}</strong></td>
                  <td>{relationLabel(sale.customer, '—')}</td>
                  <td><Status tone={sale.status === 'delivered' ? 'success' : 'info'}>{saleStatusLabels[sale.status || ''] || sale.status}</Status></td>
                  <td>{money(sale.totalCents)}</td>
                  <td>{shortDate(sale.confirmedAt || sale.updatedAt)}</td>
                  <td>{shortDate(sale.expectedDeliveryAt)}</td>
                  <td><Link href={`/admin/collections/sales/${sale.id}`}>Abrir</Link></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      ) : <EmptyState title="Nenhuma venda confirmada" copy={q ? 'Nenhuma venda corresponde à busca.' : 'Quando uma oportunidade for ganha, a venda criada aparecerá aqui.'} />}
    </ViewFrame>
  } catch (error) {
    return <ViewFrame props={props} width="fluid"><PageHeader title="Vendas" subtitle="Passo 3 do funil" /><QueryError title="Não foi possível consultar as vendas" error={error} /></ViewFrame>
  }
}
