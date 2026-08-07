import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

type RelationshipValue = string | number | { id?: string | number | null } | null | undefined
type GalleryItem = {
  image?: RelationshipValue
  [key: string]: unknown
}
type ProductDocument = {
  id: string | number
  catalogStatus?: string | null
  gallery?: GalleryItem[] | null
}
type MediaDocument = {
  id: string | number
  _status?: string | null
  sourceSha256?: string | null
}

function relationshipID(value: RelationshipValue): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object') {
    const id = value.id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  // Registros com sourceSha256 só são criados pelo importador de produtos.
  // A versão anterior criava esses assets como draft; são exatamente os que
  // geravam "A imagem precisa ser publicada antes de ser usada no site".
  const importedMedia = await payload.find({
    collection: 'media',
    where: { sourceSha256: { exists: true } },
    draft: true,
    depth: 0,
    limit: 10_000,
    pagination: false,
    overrideAccess: true,
    req,
  })

  const brokenMedia = (importedMedia.docs as unknown as MediaDocument[]).filter(
    (media) => Boolean(media.sourceSha256) && media._status !== 'published',
  )
  const brokenIds = new Set(brokenMedia.map((media) => String(media.id)))

  if (brokenIds.size) {
    const products = await payload.find({
      collection: 'products',
      draft: true,
      depth: 0,
      limit: 10_000,
      pagination: false,
      overrideAccess: true,
      req,
    })

    for (const product of products.docs as unknown as ProductDocument[]) {
      const gallery = Array.isArray(product.gallery) ? product.gallery : []
      const nextGallery = gallery.filter((item) => {
        const id = relationshipID(item.image)
        return id === null || !brokenIds.has(String(id))
      })
      if (nextGallery.length === gallery.length) continue

      // Produto ativo não pode ter uma galeria vazia pelo validator da collection.
      // Quando a limpeza remove a última imagem, o rascunho é arquivado junto e
      // pode voltar a ativo depois que a nova importação preencher a galeria.
      const data: Record<string, unknown> = { gallery: nextGallery }
      if (nextGallery.length === 0 && product.catalogStatus === 'active') {
        data.catalogStatus = 'archived'
      }

      await payload.update({
        collection: 'products',
        id: product.id,
        data: data as never,
        draft: true,
        depth: 0,
        overrideAccess: true,
        req,
      })
    }

    // Mantemos os arquivos no Media Library, mas corrigimos o estado. Se o mesmo
    // URL for importado novamente, a deduplicação por hash reutiliza um asset já
    // publicado em vez de reencontrar o draft quebrado.
    for (const media of brokenMedia) {
      await payload.update({
        collection: 'media',
        id: media.id,
        data: { _status: 'published' } as never,
        draft: false,
        depth: 0,
        overrideAccess: true,
        req,
      })
    }
  }

  payload.logger.info(
    { cleanedMedia: brokenMedia.length },
    'cleaned legacy draft media created by product import',
  )
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  // Limpeza de dados intencional: não há como reconstruir com segurança quais
  // relações de galeria o usuário já teria alterado depois desta migração.
  payload.logger.warn('cleanup_imported_product_media is intentionally not reversible')
}
