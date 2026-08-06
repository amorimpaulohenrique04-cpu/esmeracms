import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { canManageSite } from '../../../../access/roles'
import { templateRows } from '../../../../businessRules/products/importSchema'
import { toCsv } from '../../../../server/domain/products/csv'
import { commitImport, previewImport, type ImportCommitInput } from '../../../../server/domain/products/importOperations'

export const dynamic = 'force-dynamic'

type Body = {
  action?: 'preview' | 'commit'
  text?: string
  rows?: ImportCommitInput[]
}

function message(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Não foi possível processar a importação.'
}

export async function GET(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user || !canManageSite(user)) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const csv = toCsv(templateRows())
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="modelo-importacao-produtos.csv"',
    },
  })
}

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!canManageSite(user)) return NextResponse.json({ error: 'Sem permissão para importar produtos.' }, { status: 403 })

  let body: Body
  try {
    body = await request.json() as Body
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  try {
    if (body.action === 'preview') {
      if (typeof body.text !== 'string' || !body.text.trim()) {
        return NextResponse.json({ error: 'Envie um arquivo ou cole os dados antes de pré-visualizar.' }, { status: 400 })
      }
      return NextResponse.json(await previewImport(payload, user, body.text))
    }

    if (body.action === 'commit') {
      if (!Array.isArray(body.rows) || !body.rows.length) {
        return NextResponse.json({ error: 'Nenhuma linha para importar.' }, { status: 400 })
      }
      if (body.rows.length > 500) {
        return NextResponse.json({ error: 'Limite de 500 linhas por importação. Divida o arquivo em partes menores.' }, { status: 400 })
      }
      return NextResponse.json(await commitImport(payload, user, body.rows))
    }

    return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 })
  } catch (error) {
    payload.logger.error({ err: error }, 'admin products import failed')
    return NextResponse.json({ error: message(error) }, { status: 422 })
  }
}
