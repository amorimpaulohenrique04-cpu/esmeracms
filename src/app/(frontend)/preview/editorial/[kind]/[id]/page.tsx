import config from '@payload-config'
import { headers as getHeaders } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { canManageSite } from '@/access/roles'
import { EditorialPreviewDocument } from './EditorialPreviewDocument'
import './preview.css'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Preview editorial · Esméra CMS',
  robots: { index: false, follow: false },
}

type PreviewKind = 'product' | 'category'
type PageProps = { params: Promise<{ kind: string; id: string }> }

function serialize(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

export default async function EditorialPreviewPage({ params }: PageProps) {
  const { kind, id } = await params
  if (kind !== 'product' && kind !== 'category') notFound()

  const requestHeaders = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: requestHeaders })
  if (!user || !canManageSite(user)) notFound()

  try {
    const record = kind === 'product'
      ? await payload.findByID({ collection: 'products', id, draft: true, depth: 2, overrideAccess: false, user })
      : await payload.findByID({ collection: 'categories', id, draft: true, depth: 2, overrideAccess: false, user })

    return (
      <div className="esmera-editorial-preview-route" data-preview-kind={kind as PreviewKind}>
        <EditorialPreviewDocument kind={kind as PreviewKind} record={serialize(record)} />
      </div>
    )
  } catch {
    notFound()
  }
}
