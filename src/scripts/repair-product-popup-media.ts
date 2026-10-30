import 'dotenv/config'

import config from '@payload-config'
import { getPayload } from 'payload'

type ID = string | number
type MediaSnapshot = {
  id: ID
  _status?: string | null
  filename?: string | null
  url?: string | null
  filesize?: number | null
  alt?: string | null
}

type ReportItem = {
  productId: ID
  mediaId: ID
  filename: string | null
  result: 'dry-run' | 'published' | 'already-published' | 'invalid' | 'failed'
  message?: string
}

function relationID(value: unknown): ID | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

function parseProductIds(args: string[]): number[] {
  const option = args.find((arg) => arg.startsWith('--product-ids='))
  const raw = option?.slice('--product-ids='.length)
  if (!raw) throw new Error('Informe --product-ids=778,780,781 para selecionar explicitamente os produtos.')

  const tokens = raw.split(',').map((value) => value.trim())
  if (tokens.some((value) => !/^[1-9][0-9]*$/.test(value))) {
    throw new Error('Todos os IDs dos produtos precisam ser inteiros positivos.')
  }
  const ids = [...new Set(tokens.map(Number))]
  if (ids.some((value) => !Number.isSafeInteger(value))) throw new Error('ID de produto inválido.')
  return ids
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--apply') && args.includes('--dry-run')) {
    throw new Error('Escolha apenas --apply ou --dry-run.')
  }
  // Apenas a operação --apply permite gravações. Por padrão o comando é somente leitura.
  const apply = args.includes('--apply')
  const productIds = parseProductIds(args)
  const payload = await getPayload({ config: await config })
  const report: ReportItem[] = []
  const visited = new Set<string>()

  for (const productId of productIds) {
    const product = await payload.findByID({
      collection: 'products',
      id: productId,
      depth: 0,
      draft: true,
      overrideAccess: true,
    })
    const gallery = Array.isArray(product.gallery) ? product.gallery : []

    for (const item of gallery) {
      const mediaId = relationID(item.image)
      if (mediaId === null) {
        report.push({ productId, mediaId: 'missing', filename: null, result: 'invalid', message: 'Relacionamento de mídia inválido.' })
        continue
      }
      if (visited.has(String(mediaId))) continue
      visited.add(String(mediaId))

      try {
        const media = await payload.findByID({
          collection: 'media',
          id: mediaId,
          depth: 0,
          draft: true,
          overrideAccess: true,
        }) as MediaSnapshot

        const filename = media.filename ?? null
        if (media._status === 'published') {
          report.push({ productId, mediaId, filename, result: 'already-published' })
          continue
        }
        // Nunca tornar pública uma mídia sem arquivo identificado. Não reenvia
        // imagem nem modifica o produto; preserva todas as relações e versões.
        if (!filename || !media.url || !media.filesize || media.filesize <= 0 || !media.alt?.trim()) {
          report.push({
            productId, mediaId, filename, result: 'invalid',
            message: 'Arquivo ou metadados incompletos; revisar manualmente antes de publicar.',
          })
          continue
        }

        if (!apply) {
          report.push({ productId, mediaId, filename, result: 'dry-run' })
          continue
        }

        // Publicar pela API do Payload mantém o histórico de versões coerente.
        const updated = await payload.update({
          collection: 'media',
          id: mediaId,
          data: { _status: 'published' },
          draft: false,
          depth: 0,
          overrideAccess: true,
        })
        const verified = await payload.findByID({
          collection: 'media',
          id: mediaId,
          draft: false,
          depth: 0,
          overrideAccess: true,
        })
        if (updated._status !== 'published' || verified._status !== 'published') {
          throw new Error('O Payload não confirmou a publicação da mídia.')
        }
        report.push({ productId, mediaId, filename, result: 'published' })
      } catch (error) {
        report.push({
          productId,
          mediaId,
          filename: null,
          result: 'failed',
          message: error instanceof Error ? error.message : 'Erro inesperado.',
        })
      }
    }
  }

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    selectedProductIds: productIds,
    scannedMediaCount: visited.size,
    published: report.filter((item) => item.result === 'published').length,
    candidates: report.filter((item) => item.result === 'dry-run').length,
    alreadyPublished: report.filter((item) => item.result === 'already-published').length,
    invalid: report.filter((item) => item.result === 'invalid').length,
    failed: report.filter((item) => item.result === 'failed').length,
    report,
  }
  console.log(JSON.stringify(summary, null, 2))
  if (summary.invalid || summary.failed) process.exitCode = 1
}

main()
  .then(() => process.exit(process.exitCode ? 1 : 0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
