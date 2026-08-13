import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { canManageSite } from '../../../../access/roles'
import { adminCodedError, adminErrorResponse } from '../../../../server/admin/errors'

export const dynamic = 'force-dynamic'

function altFromFilename(filename: string) {
  const base = filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
  return base ? base.slice(0, 180) : 'Imagem do produto'
}

// Upload de imagem para a galeria a partir do popup de criação. O admin custom
// não possui endpoint de upload — a mídia nativa só entra pelo editor do Payload.
// Aqui recebemos multipart, criamos o documento em `media` (respeitando o acesso
// de siteEditors via overrideAccess:false) e devolvemos o id para o cliente
// anexar com a action `add-gallery-image`, que já gera mediaKey, capa e alt.
export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return adminCodedError('unauthenticated')
  if (!canManageSite(user)) return adminCodedError('forbidden', { summary: 'Sem permissão para enviar mídia.' })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return adminCodedError('invalid_request', { summary: 'Envio inválido.' })
  }

  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) return adminCodedError('invalid_request', { summary: 'Selecione uma imagem.' })
  if (!file.type.startsWith('image/')) return adminCodedError('invalid_request', { summary: 'Envie um arquivo de imagem.' })

  const providedAlt = String(form.get('alt') || '').trim()
  const alt = (providedAlt || altFromFilename(file.name || 'imagem')).slice(0, 180)

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const media = await payload.create({
      collection: 'media',
      data: { alt },
      file: { data: buffer, mimetype: file.type, name: file.name || 'imagem', size: file.size },
      overrideAccess: false,
      user,
    })
    return NextResponse.json({
      id: media.id,
      url: media.url ?? null,
      filename: media.filename ?? null,
      alt: media.alt ?? alt,
      sizes: media.sizes ?? null,
    })
  } catch (error) {
    return adminErrorResponse(error, {
      entity: 'product',
      operation: 'upload-media',
      logger: payload.logger,
    })
  }
}
