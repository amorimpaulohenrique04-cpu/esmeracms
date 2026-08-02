import 'dotenv/config'

import config from '@payload-config'
import { getPayload } from 'payload'

import {
  migrateCommercialLeadsToOpportunities,
  rollbackCommercialLeadOpportunityMigration,
} from '../server/domain/opportunities/migration'

const flags = new Set(process.argv.slice(2))
const dryRun = flags.has('--dry-run')
const rollback = flags.has('--rollback')
const allowSkips = flags.has('--allow-skips')

if (dryRun && rollback) {
  console.error('Use --dry-run ou --rollback, não os dois ao mesmo tempo.')
  process.exit(2)
}

const payload = await getPayload({ config: await config })
const report = rollback
  ? await rollbackCommercialLeadOpportunityMigration(payload)
  : await migrateCommercialLeadsToOpportunities(payload, { dryRun })

console.log(JSON.stringify(report, null, 2))

if (report.skipped > 0 && !allowSkips) {
  console.error('A operação terminou com registros ignorados. Corrija os vínculos ou execute conscientemente com --allow-skips.')
  process.exit(1)
}

process.exit(0)
