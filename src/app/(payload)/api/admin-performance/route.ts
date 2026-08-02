import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { isAdmin } from '../../../../access/roles'
import { PERFORMANCE_BUDGETS, performanceSnapshot } from '../../../../server/performance'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: 'Apenas administradores podem consultar a telemetria.' }, { status: 403 })

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    budgets: PERFORMANCE_BUDGETS,
    measurements: performanceSnapshot(),
    note: 'Amostras são locais ao processo e não contêm filtros, nomes, e-mails, telefones ou outros dados pessoais.',
  })
}
