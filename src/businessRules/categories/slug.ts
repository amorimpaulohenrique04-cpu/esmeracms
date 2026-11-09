import type { PayloadRequest } from 'payload'

import { slugify } from '../../fields/common'

export function nextAvailableSlug(base: string, taken: Set<string>) {
  if (!taken.has(base)) return base
  let suffix = 2
  while (taken.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

/** Inclui a lixeira: o índice único do banco também enxerga itens excluídos. */
export async function uniqueCategorySlug(req: PayloadRequest, title: string) {
  const base = slugify(title)
  if (!base) return base
  const existing = await req.payload.find({
    collection: 'categories',
    depth: 0,
    limit: 500,
    pagination: false,
    overrideAccess: true,
    req,
    trash: true,
    where: { slug: { like: base } },
    select: { slug: true },
  })
  return nextAvailableSlug(base, new Set(existing.docs.map((doc) => String(doc.slug))))
}
