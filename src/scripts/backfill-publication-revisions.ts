import 'dotenv/config'

import config from '@payload-config'
import { pathToFileURL } from 'node:url'
import { getPayload, type Payload } from 'payload'

import { createPublicPublicationMetadata, type PublicRevisionEntity } from '../server/publication/publicRevision'

export type BackfillSummary = {
  scanned: number
  updated: number
  unchanged: number
  failed: number
}

type BackfillReport = Record<PublicRevisionEntity, BackfillSummary>

type PublicDocument = Record<string, unknown>

function emptySummary(): BackfillSummary {
  return { scanned: 0, updated: 0, unchanged: 0, failed: 0 }
}

function record(value: unknown): PublicDocument | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as PublicDocument
    : null
}

async function processCollection(
  payload: Payload,
  input: {
    entity: 'product' | 'category'
    collection: 'products' | 'categories'
    dryRun: boolean
  },
): Promise<BackfillSummary> {
  const summary = emptySummary()
  let page = 1
  let totalPages = 1

  do {
    const result = await payload.find({
      collection: input.collection,
      where: { _status: { equals: 'published' } },
      depth: 2,
      draft: false,
      limit: 100,
      page,
      sort: 'id',
      overrideAccess: true,
    })
    totalPages = result.totalPages

    for (const value of result.docs) {
      summary.scanned += 1
      const document = record(value)
      try {
        if (!document) throw new Error('Documento público inválido.')
        const metadata = createPublicPublicationMetadata(input.entity, document)
        if (
          document.publicationRevision === metadata.revision &&
          document.publicationContractVersion === metadata.contractVersion
        ) {
          summary.unchanged += 1
          continue
        }

        if (!input.dryRun) {
          await payload.update({
            collection: input.collection,
            id: document.id as string | number,
            data: {
              publicationRevision: metadata.revision,
              publicationContractVersion: metadata.contractVersion,
            } as never,
            draft: false,
            overrideAccess: true,
            context: { skipPublicRevisionStamp: true },
          })
        }
        summary.updated += 1
      } catch (error) {
        summary.failed += 1
        payload.logger.error({ err: error, entity: input.entity, id: document?.id }, 'public revision backfill item failed')
      }
    }

    page += 1
  } while (page <= totalPages)

  return summary
}

async function processHome(payload: Payload, dryRun: boolean): Promise<BackfillSummary> {
  const summary = emptySummary()
  try {
    const document = record(await payload.findGlobal({
      slug: 'home',
      depth: 2,
      draft: false,
      overrideAccess: true,
    }))
    if (!document || document._status !== 'published') return summary

    summary.scanned = 1
    const metadata = createPublicPublicationMetadata('home', document)
    if (
      document.publicationRevision === metadata.revision &&
      document.publicationContractVersion === metadata.contractVersion
    ) {
      summary.unchanged = 1
      return summary
    }

    if (!dryRun) {
      await payload.updateGlobal({
        slug: 'home',
        data: {
          publicationRevision: metadata.revision,
          publicationContractVersion: metadata.contractVersion,
        } as never,
        draft: false,
        overrideAccess: true,
        context: { skipPublicRevisionStamp: true },
      })
    }
    summary.updated = 1
  } catch (error) {
    summary.failed = 1
    payload.logger.error({ err: error, entity: 'home' }, 'public revision backfill item failed')
  }
  return summary
}

export async function backfillPublicationRevisions(
  payload: Payload,
  options: { dryRun?: boolean } = {},
): Promise<BackfillReport> {
  const dryRun = options.dryRun === true
  return {
    product: await processCollection(payload, { entity: 'product', collection: 'products', dryRun }),
    category: await processCollection(payload, { entity: 'category', collection: 'categories', dryRun }),
    home: await processHome(payload, dryRun),
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dryRun = new Set(process.argv.slice(2)).has('--dry-run')
  const payload = await getPayload({ config: await config })
  const report = await backfillPublicationRevisions(payload, { dryRun })
  console.log(JSON.stringify({ dryRun, ...report }, null, 2))
  process.exit(Object.values(report).some((summary) => summary.failed > 0) ? 1 : 0)
}
