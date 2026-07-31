import type { PayloadRequest } from 'payload'

type RelatedCollection = 'leads' | 'customers' | 'sales' | 'after-sales' | 'tasks'
type ActivityKind = 'contact' | 'message' | 'proposal' | 'stage_change' | 'note' | 'delivery' | 'follow_up'

export async function recordSemanticActivity({
  req,
  kind,
  summary,
  details,
  relationTo,
  value,
}: {
  req: PayloadRequest
  kind: ActivityKind
  summary: string
  details?: string
  relationTo: RelatedCollection
  value: string | number
}) {
  try {
    await req.payload.create({
      collection: 'activities',
      data: {
        kind,
        occurredAt: new Date().toISOString(),
        summary,
        details,
        ownerUser: req.user?.id ?? undefined,
        relatedTo: [{ relationTo, value }],
      },
      overrideAccess: true,
      req,
    })
  } catch (error) {
    req.payload.logger.warn({
      err: error,
      msg: `Não foi possível registrar Activity automática para ${relationTo}:${value}`,
    })
  }
}
