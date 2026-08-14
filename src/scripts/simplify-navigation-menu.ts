import 'dotenv/config'

import config from '@payload-config'
import { getPayload } from 'payload'

/**
 * Enxuga o menu principal: "A Esméra", "Pronta entrega" e "Sob encomenda"
 * viram páginas únicas (sem ramificações no menu), e as subcategorias de
 * PEÇAS/COLEÇÕES sem nenhum produto ativo deixam de poluir o mega-menu.
 *
 * Arquiva (status: 'archive') em vez de apagar — os documentos continuam no
 * Payload, apenas saem do catálogo público (loadPublicCategories filtra por
 * status: active). Reversível via --rollback.
 */

const ARCHIVE_SLUGS = [
  // Filhos de "A ESMÉRA" (id 6) — vira link único, sem dropdown.
  'sobre-a-esmera',
  'design-autoral',
  'processo-e-materia',
  'pedras-naturais',
  'feito-a-mao',
  'cuidados-com-as-pecas',
  'duvidas-frequentes',
  'contato',
  // Filhos de "SOB ENCOMENDA" (id 5) — vira página única de coleção.
  'como-funciona',
  'pecas-sob-encomenda',
  'personalizacao-de-pedras',
  'personalizacao-de-medidas',
  'acabamentos',
  'prazos-de-producao',
  'solicitar-orcamento',
  'falar-com-a-esmera',
  // Filhos de "PRONTA ENTREGA" (id 4) — vira página única de coleção.
  'novidades',
  'ultimas-unidades',
  // Subcategorias de PEÇAS/COLEÇÕES sem nenhum produto ativo publicado.
  'kits-lavabo',
  'vasos-individuais',
  'centros-de-mesa',
  'navegar',
  'esculturas',
  'objetos-autorais',
  'objetos-decorativos',
  'lancamentos',
  'pecas-autorais',
] as const

// "Sob encomenda" também deixa de ser 'hybrid' (regra + atribuição manual) e
// passa a ser puramente 'rules': só produtos com availability=made_to_order.
const SOB_ENCOMENDA_SLUG = 'sob-encomenda'

const flags = new Set(process.argv.slice(2))
const dryRun = flags.has('--dry-run')
const rollback = flags.has('--rollback')

if (dryRun && rollback) {
  console.error('Use --dry-run ou --rollback, não os dois ao mesmo tempo.')
  process.exit(2)
}

type CategoryRow = {
  id: string | number
  slug?: string | null
  title?: string | null
  status?: string | null
  parent?: unknown
}

async function findBySlugs(payload: Awaited<ReturnType<typeof getPayload>>, slugs: readonly string[]) {
  const result = await payload.find({
    collection: 'categories',
    overrideAccess: true,
    depth: 0,
    limit: 200,
    pagination: false,
    draft: true,
    where: { slug: { in: slugs as unknown as string[] } },
    select: { slug: true, title: true, status: true, parent: true },
  })
  return result.docs as unknown as CategoryRow[]
}

async function runMigration(payload: Awaited<ReturnType<typeof getPayload>>) {
  const categories = await findBySlugs(payload, ARCHIVE_SLUGS)
  const found = new Map(categories.map((category) => [category.slug || '', category]))
  const missing = ARCHIVE_SLUGS.filter((slug) => !found.has(slug))
  const alreadyArchived = categories.filter((category) => category.status === 'archive')
  const toArchive = categories.filter((category) => category.status !== 'archive')

  let archived = 0
  for (const category of toArchive) {
    console.log(`[menu] arquivar categoria: ${category.slug} (${category.title})`)
    if (!dryRun) {
      await payload.update({
        collection: 'categories',
        id: category.id,
        overrideAccess: true,
        draft: false,
        depth: 0,
        data: { status: 'archive' } as never,
      })
    }
    archived += 1
  }

  const [sobEncomenda] = await findBySlugsWithListingMode(payload, [SOB_ENCOMENDA_SLUG])
  let listingModeChanged = false
  if (sobEncomenda && sobEncomenda.listingMode !== 'rules') {
    console.log(`[menu] ${SOB_ENCOMENDA_SLUG}: listingMode ${sobEncomenda.listingMode} -> rules`)
    if (!dryRun) {
      await payload.update({
        collection: 'categories',
        id: sobEncomenda.id,
        overrideAccess: true,
        draft: false,
        depth: 0,
        data: { listingMode: 'rules' } as never,
      })
    }
    listingModeChanged = true
  }

  console.log(JSON.stringify({
    mode: dryRun ? 'dry-run' : 'apply',
    requested: ARCHIVE_SLUGS.length,
    missing,
    alreadyArchived: alreadyArchived.map((category) => category.slug),
    archived,
    sobEncomendaListingModeChanged: listingModeChanged,
  }, null, 2))

  if (missing.length) {
    console.error(`Aviso: ${missing.length} slug(s) não encontrado(s): ${missing.join(', ')}`)
  }
}

type CategoryWithListingMode = CategoryRow & { listingMode?: string | null }

async function findBySlugsWithListingMode(payload: Awaited<ReturnType<typeof getPayload>>, slugs: readonly string[]) {
  const result = await payload.find({
    collection: 'categories',
    overrideAccess: true,
    depth: 0,
    limit: 10,
    pagination: false,
    draft: true,
    where: { slug: { in: slugs as unknown as string[] } },
    select: { slug: true, title: true, listingMode: true },
  })
  return result.docs as unknown as CategoryWithListingMode[]
}

async function runRollback(payload: Awaited<ReturnType<typeof getPayload>>) {
  const categories = await findBySlugs(payload, ARCHIVE_SLUGS)
  let restored = 0
  for (const category of categories.filter((c) => c.status === 'archive')) {
    console.log(`[menu] restaurar categoria: ${category.slug} (${category.title})`)
    if (!dryRun) {
      await payload.update({
        collection: 'categories',
        id: category.id,
        overrideAccess: true,
        draft: false,
        depth: 0,
        data: { status: 'active' } as never,
      })
    }
    restored += 1
  }

  const [sobEncomenda] = await findBySlugsWithListingMode(payload, [SOB_ENCOMENDA_SLUG])
  let listingModeRestored = false
  if (sobEncomenda && sobEncomenda.listingMode === 'rules') {
    console.log(`[menu] ${SOB_ENCOMENDA_SLUG}: listingMode rules -> hybrid`)
    if (!dryRun) {
      await payload.update({
        collection: 'categories',
        id: sobEncomenda.id,
        overrideAccess: true,
        draft: false,
        depth: 0,
        data: { listingMode: 'hybrid' } as never,
      })
    }
    listingModeRestored = true
  }

  console.log(JSON.stringify({ mode: dryRun ? 'dry-run' : 'rollback', restored, listingModeRestored }, null, 2))
}

const payload = await getPayload({ config: await config })
if (rollback) await runRollback(payload)
else await runMigration(payload)
process.exit(0)
