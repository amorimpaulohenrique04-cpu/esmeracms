import fs from 'node:fs/promises'
import path from 'node:path'

import { getPayload } from 'payload'

import config from '../payload.config'

const root = process.cwd()
const outputDir = path.join(root, 'artifacts', 'admin-baseline')
const datasetVersion = process.env.VISUAL_DATASET_VERSION || 'stage23-v1'
const databaseURL = process.env.DATABASE_URL || ''
const explicitLocalReset = process.env.ALLOW_VISUAL_DATA_RESET === 'true'
const runningInCI = process.env.CI === 'true'
const localDatabase = /(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(databaseURL)

const deletionOrder = [
  'payload-locked-documents',
  'payload-preferences',
  'payload-jobs',
  'report-exports',
  'activities',
  'occurrences',
  'shipments',
  'tasks',
  'after-sales',
  'sales',
  'opportunities',
  'client-interests',
  'leads',
  'customers',
  'products',
  'categories',
  'report-export-files',
  'media',
  'users',
] as const

function assertIsolatedDatabase() {
  if ((!runningInCI && !explicitLocalReset) || (!localDatabase && !explicitLocalReset)) {
    throw new Error(
      'A preparação visual apaga dados. Use somente o banco local de teste ou defina ALLOW_VISUAL_DATA_RESET=true de forma explícita.',
    )
  }
}

async function main() {
  assertIsolatedDatabase()
  const payload = await getPayload({ config: await config })

  try {
    const availableCollections = new Set(Object.keys(payload.collections))

    for (const collection of deletionOrder) {
      if (!availableCollections.has(collection)) continue

      const result = await payload.delete({
        collection: collection as never,
        depth: 0,
        overrideAccess: true,
        where: { id: { exists: true } },
      } as never) as unknown as { docs?: unknown[] }

      console.log(`Baseline reset: ${collection} · ${result.docs?.length || 0} registro(s) removido(s).`)
    }

    await fs.rm(outputDir, { recursive: true, force: true })
    await fs.mkdir(outputDir, { recursive: true })
    await fs.writeFile(
      path.join(outputDir, 'baseline-manifest.json'),
      `${JSON.stringify({
        datasetVersion,
        preparedAt: new Date().toISOString(),
        source: 'prepare-visual-baseline',
      }, null, 2)}\n`,
      'utf8',
    )

    console.log(`Dataset visual ${datasetVersion} preparado em banco isolado.`)
  } finally {
    const database = payload.db as unknown as { destroy?: () => Promise<void> }
    if (typeof database.destroy === 'function') {
      await Promise.race([
        database.destroy(),
        new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
      ])
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
