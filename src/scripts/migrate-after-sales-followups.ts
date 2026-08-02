import 'dotenv/config'

import { getPayload } from 'payload'

import config from '../payload.config'
import { taskTypeLabels, type TaskType } from '../businessRules/afterSales/model'
import { relationshipID } from '../businessRules/relationships'

type LegacyFollowUp = {
  id?: string | number | null
  dueAt?: string | null
  purpose?: string | null
  status?: string | null
  notes?: string | null
  completedAt?: string | null
}

type AfterSalesCase = {
  id: string | number
  caseNumber?: string | null
  sale?: unknown
  customer?: unknown
  owner?: unknown
  followUps?: LegacyFollowUp[] | null
}

const dryRun = process.argv.includes('--dry-run')
const rollback = process.argv.includes('--rollback')

const purposeType: Record<string, TaskType> = {
  receipt: 'delivery_confirmation',
  satisfaction: 'satisfaction',
  testimonial: 'testimonial',
  maintenance: 'maintenance',
  curation: 'curation',
  other: 'custom',
}

function sourceKey(caseId: string | number, followUp: LegacyFollowUp, index: number) {
  return `after-sales:${caseId}:followup:${followUp.id ?? index}`
}

async function allCases(payload: Awaited<ReturnType<typeof getPayload>>) {
  const docs: AfterSalesCase[] = []
  let page = 1
  while (true) {
    const result = await payload.find({
      collection: 'after-sales',
      overrideAccess: true,
      depth: 0,
      page,
      limit: 100,
      select: { caseNumber: true, sale: true, customer: true, owner: true, followUps: true },
    })
    docs.push(...result.docs as unknown as AfterSalesCase[])
    if (!result.hasNextPage) break
    page += 1
  }
  return docs
}

async function runRollback(payload: Awaited<ReturnType<typeof getPayload>>) {
  const migrated = await payload.find({
    collection: 'tasks',
    overrideAccess: true,
    depth: 0,
    limit: 1000,
    where: { legacySourceKey: { contains: 'after-sales:' } },
    select: { title: true, legacySourceKey: true },
  })
  console.log(`[after-sales] rollback encontrou ${migrated.totalDocs} Tasks migradas.`)
  if (dryRun) return
  for (const task of migrated.docs) await payload.delete({ collection: 'tasks', id: task.id, overrideAccess: true })
  console.log(`[after-sales] rollback removeu ${migrated.docs.length} Tasks.`)
}

async function runMigration(payload: Awaited<ReturnType<typeof getPayload>>) {
  const cases = await allCases(payload)
  let inspected = 0
  let created = 0
  let existing = 0
  let skipped = 0

  for (const afterSalesCase of cases) {
    const sale = relationshipID(afterSalesCase.sale)
    const customer = relationshipID(afterSalesCase.customer)
    const owner = relationshipID(afterSalesCase.owner)
    for (const [index, followUp] of (afterSalesCase.followUps || []).entries()) {
      inspected += 1
      if (!followUp.dueAt || Number.isNaN(new Date(followUp.dueAt).getTime())) {
        skipped += 1
        console.warn(`[after-sales] follow-up sem prazo válido em ${afterSalesCase.caseNumber || afterSalesCase.id}; ignorado.`)
        continue
      }
      const key = sourceKey(afterSalesCase.id, followUp, index)
      const duplicate = await payload.find({
        collection: 'tasks',
        overrideAccess: true,
        depth: 0,
        limit: 1,
        where: { legacySourceKey: { equals: key } },
      })
      if (duplicate.totalDocs) {
        existing += 1
        continue
      }

      const type = purposeType[followUp.purpose || ''] || 'custom'
      const relatedTo = [
        { relationTo: 'after-sales' as const, value: afterSalesCase.id },
        sale !== null ? { relationTo: 'sales' as const, value: sale } : null,
        customer !== null ? { relationTo: 'customers' as const, value: customer } : null,
      ].filter(Boolean)
      const status = followUp.status === 'done' ? 'done' : followUp.status === 'cancelled' ? 'cancelled' : 'pending'
      const title = `${taskTypeLabels[type]} · ${afterSalesCase.caseNumber || afterSalesCase.id}`

      if (!dryRun) {
        await payload.create({
          collection: 'tasks',
          overrideAccess: true,
          context: { skipAfterSalesActivity: true },
          data: {
            title,
            type,
            status,
            priority: 'normal',
            dueAt: new Date(followUp.dueAt).toISOString(),
            assignee: owner,
            relatedTo,
            notes: followUp.notes || null,
            completedAt: followUp.completedAt || null,
            legacySourceKey: key,
          } as never,
        })
      }
      created += 1
    }
  }

  console.log(JSON.stringify({ mode: dryRun ? 'dry-run' : 'apply', cases: cases.length, inspected, created, existing, skipped }, null, 2))
}

const payload = await getPayload({ config: await config })
if (rollback) await runRollback(payload)
else await runMigration(payload)
process.exit(0)
