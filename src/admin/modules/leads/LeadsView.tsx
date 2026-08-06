/* eslint-disable react-hooks/error-boundaries -- Query failures are handled here; render failures remain handled by the Next.js/Payload boundaries. */
import type { AdminViewServerProps, Where } from 'payload'

import { FunnelStepper } from '../../design-system'
import {
  AccessDenied,
  ensureUser,
  findDocs,
  PageHeader,
  QueryError,
  ViewFrame,
} from '../../views/shared'
import { LeadsHydratedWorkspace } from './LeadsHydratedWorkspace'
import type { LeadFilters, LeadRecord } from './types'
import './leads.scss'

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

async function paramsOf(props: AdminViewServerProps) {
  return await Promise.resolve(props.searchParams as unknown as Record<string, string | string[] | undefined>)
}

function filtersFrom(params: Record<string, string | string[] | undefined>): LeadFilters {
  return { q: (first(params.q) || '').trim().slice(0, 120) }
}

export async function LeadsView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'business')
  if (!allowed) return <AccessDenied props={props} area="comercial" />

  const req = props.initPageResult.req
  const filters = filtersFrom(await paramsOf(props))
  const where: Where | undefined = filters.q
    ? { or: [{ name: { like: filters.q } }, { phone: { like: filters.q } }, { email: { like: filters.q } }, { notes: { like: filters.q } }] }
    : undefined

  try {
    const leadResult = await findDocs<LeadRecord>(req, 'leads', {
      sort: '-updatedAt',
      limit: 200,
      depth: 1,
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        source: true,
        notes: true,
        opportunity: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return <ViewFrame props={props}>
      <PageHeader
        eyebrow="Passo 1 do funil"
        title="Captação"
        subtitle="Leads recebidos até serem qualificados e virarem uma oportunidade. Use “+ Novo” para registrar um novo lead."
      />
      <FunnelStepper current={1} />
      <LeadsHydratedWorkspace leads={leadResult.docs} filters={filters} />
    </ViewFrame>
  } catch (error) {
    return <ViewFrame props={props}><PageHeader title="Captação" subtitle="Passo 1 do funil" /><QueryError title="Não foi possível consultar os leads" error={error} /></ViewFrame>
  }
}
