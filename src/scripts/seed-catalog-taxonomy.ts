import config from '@payload-config'
import { getPayload } from 'payload'

type NodeType = 'collection' | 'editorial' | 'external' | 'group'
type TaxonomyAxis = 'navigation' | 'piece_type' | 'collection' | 'environment' | 'campaign' | 'service'
type ListingMode = 'assigned' | 'descendants' | 'rules' | 'hybrid'

type SeedNode = {
  key: string
  title: string
  slug: string
  nodeType: NodeType
  taxonomyAxis: TaxonomyAxis
  listingMode?: ListingMode
  parentKey?: string
  order: number
  description?: string
  hubPath?: string
  availability?: Array<'unique' | 'available' | 'made_to_order' | 'limited'>
}

type ExistingCategory = {
  id: string | number
  slug?: string | null
  title?: string | null
  status?: string | null
  _status?: string | null
}

const nodes: SeedNode[] = [
  { key: 'pieces', title: 'PEÇAS', slug: 'pecas', nodeType: 'collection', taxonomyAxis: 'navigation', listingMode: 'descendants', order: 100 },
  { key: 'collections', title: 'COLEÇÕES', slug: 'colecoes', nodeType: 'collection', taxonomyAxis: 'navigation', listingMode: 'descendants', order: 200 },
  { key: 'ready', title: 'PRONTA ENTREGA', slug: 'pronta-entrega', nodeType: 'collection', taxonomyAxis: 'campaign', listingMode: 'rules', availability: ['available', 'unique', 'limited'], order: 300 },
  { key: 'made-to-order', title: 'SOB ENCOMENDA', slug: 'sob-encomenda', nodeType: 'collection', taxonomyAxis: 'service', listingMode: 'hybrid', availability: ['made_to_order'], description: 'Peças, possibilidades de personalização e informações de produção sob encomenda.', order: 400 },
  { key: 'about-root', title: 'A ESMÉRA', slug: 'a-esmera', nodeType: 'editorial', taxonomyAxis: 'navigation', description: 'Conheça a Esméra, seus processos, materiais e cuidados com as peças.', order: 500 },

  { key: 'lavabo', title: 'LAVABO', slug: 'lavabo', nodeType: 'collection', taxonomyAxis: 'environment', listingMode: 'descendants', parentKey: 'pieces', order: 100 },
  { key: 'lavabo-kits', title: 'Kits Lavabo', slug: 'kits-lavabo', nodeType: 'collection', taxonomyAxis: 'piece_type', parentKey: 'lavabo', order: 100 },
  { key: 'lavabo-trays', title: 'Bandejas para lavabo', slug: 'bandejas-para-lavabo', nodeType: 'collection', taxonomyAxis: 'piece_type', parentKey: 'lavabo', order: 200 },
  { key: 'liquid-soap', title: 'Porta-sabonete líquido', slug: 'porta-sabonete-liquido', nodeType: 'collection', taxonomyAxis: 'piece_type', parentKey: 'lavabo', order: 300 },
  { key: 'soap-dishes', title: 'Saboneteiras', slug: 'saboneteiras', nodeType: 'collection', taxonomyAxis: 'piece_type', parentKey: 'lavabo', order: 400 },
  { key: 'diffusers', title: 'Difusores', slug: 'difusores', nodeType: 'collection', taxonomyAxis: 'piece_type', parentKey: 'lavabo', order: 500 },
  { key: 'toothbrush', title: 'Porta-escova', slug: 'porta-escova', nodeType: 'collection', taxonomyAxis: 'piece_type', parentKey: 'lavabo', order: 600 },
  { key: 'cotton', title: 'Porta-algodão e cotonete', slug: 'porta-algodao-cotonete', nodeType: 'collection', taxonomyAxis: 'piece_type', parentKey: 'lavabo', order: 700 },
  { key: 'crystals-lavabo', title: 'Porta-cristais para lavabo', slug: 'porta-cristais-lavabo', nodeType: 'collection', taxonomyAxis: 'piece_type', parentKey: 'lavabo', order: 800 },

  { key: 'trays', title: 'BANDEJAS', slug: 'bandejas', nodeType: 'collection', taxonomyAxis: 'piece_type', listingMode: 'descendants', parentKey: 'pieces', order: 200 },
  { key: 'trays-small', title: 'Bandejas pequenas', slug: 'bandejas-pequenas', nodeType: 'collection', taxonomyAxis: 'piece_type', parentKey: 'trays', order: 100 },
  { key: 'trays-medium', title: 'Bandejas médias', slug: 'bandejas-medias', nodeType: 'collection', taxonomyAxis: 'piece_type', parentKey: 'trays', order: 200 },
  { key: 'trays-large', title: 'Bandejas grandes', slug: 'bandejas-grandes', nodeType: 'collection', taxonomyAxis: 'piece_type', parentKey: 'trays', order: 300 },
  { key: 'trays-max', title: 'Bandeja Max', slug: 'bandeja-max', nodeType: 'collection', taxonomyAxis: 'piece_type', parentKey: 'trays', order: 400 },

  { key: 'vases-centers', title: 'VASOS & CENTROS', slug: 'vasos-e-centros', nodeType: 'collection', taxonomyAxis: 'piece_type', listingMode: 'descendants', parentKey: 'pieces', order: 300 },
  { key: 'vase-sets', title: 'Conjuntos de vasos', slug: 'conjuntos-de-vasos', nodeType: 'collection', taxonomyAxis: 'piece_type', parentKey: 'vases-centers', order: 100 },
  { key: 'vases', title: 'Vasos individuais', slug: 'vasos-individuais', nodeType: 'collection', taxonomyAxis: 'piece_type', parentKey: 'vases-centers', order: 200 },
  { key: 'centerpieces', title: 'Centros de mesa', slug: 'centros-de-mesa', nodeType: 'collection', taxonomyAxis: 'piece_type', parentKey: 'vases-centers', order: 300 },

  { key: 'table-serving', title: 'MESA & SERVIR', slug: 'mesa-e-servir', nodeType: 'collection', taxonomyAxis: 'environment', listingMode: 'descendants', parentKey: 'pieces', order: 400 },
  { key: 'serving-line', title: 'Linha Servir', slug: 'linha-servir', nodeType: 'collection', taxonomyAxis: 'collection', parentKey: 'table-serving', order: 100 },
  { key: 'bowls', title: 'Bowls', slug: 'bowls', nodeType: 'collection', taxonomyAxis: 'piece_type', parentKey: 'table-serving', order: 200 },
  { key: 'small-plates', title: 'Pratinhos', slug: 'pratinhos', nodeType: 'collection', taxonomyAxis: 'piece_type', parentKey: 'table-serving', order: 300 },
  { key: 'coasters', title: 'Descanso de copo', slug: 'descanso-de-copo', nodeType: 'collection', taxonomyAxis: 'piece_type', parentKey: 'table-serving', order: 400 },
  { key: 'cutlery-rest', title: 'Descanso de talher', slug: 'descanso-de-talher', nodeType: 'collection', taxonomyAxis: 'piece_type', parentKey: 'table-serving', order: 500 },
  { key: 'hashi-rest', title: 'Descanso de hashi', slug: 'descanso-de-hashi', nodeType: 'collection', taxonomyAxis: 'piece_type', parentKey: 'table-serving', order: 600 },
  { key: 'side-tables', title: 'Mesas de apoio', slug: 'mesas-de-apoio', nodeType: 'collection', taxonomyAxis: 'piece_type', parentKey: 'table-serving', order: 700 },

  { key: 'design-objects', title: 'OBJETOS DE DESIGN', slug: 'objetos-de-design', nodeType: 'collection', taxonomyAxis: 'piece_type', listingMode: 'descendants', parentKey: 'pieces', order: 500 },
  { key: 'encounter', title: 'Encontro', slug: 'encontro', nodeType: 'collection', taxonomyAxis: 'collection', parentKey: 'design-objects', order: 100 },
  { key: 'navigate', title: 'Navegar', slug: 'navegar', nodeType: 'collection', taxonomyAxis: 'collection', parentKey: 'design-objects', order: 200 },
  { key: 'gelato', title: 'Gelato', slug: 'gelato', nodeType: 'collection', taxonomyAxis: 'collection', parentKey: 'design-objects', order: 300 },
  { key: 'sculptures', title: 'Esculturas', slug: 'esculturas', nodeType: 'collection', taxonomyAxis: 'piece_type', parentKey: 'design-objects', order: 400 },
  { key: 'authorial-objects', title: 'Objetos autorais', slug: 'objetos-autorais', nodeType: 'collection', taxonomyAxis: 'piece_type', parentKey: 'design-objects', order: 500 },

  { key: 'objects-atmosphere', title: 'OBJETOS & ATMOSFERA', slug: 'objetos-e-atmosfera', nodeType: 'collection', taxonomyAxis: 'environment', listingMode: 'descendants', parentKey: 'pieces', order: 600 },
  { key: 'candle-holders', title: 'Porta-velas', slug: 'porta-velas', nodeType: 'collection', taxonomyAxis: 'piece_type', parentKey: 'objects-atmosphere', order: 100 },
  { key: 'illuminate-set', title: 'Conjunto Iluminar', slug: 'conjunto-iluminar', nodeType: 'collection', taxonomyAxis: 'collection', parentKey: 'objects-atmosphere', order: 200 },
  { key: 'crystal-holders', title: 'Porta-cristais', slug: 'porta-cristais', nodeType: 'collection', taxonomyAxis: 'piece_type', parentKey: 'objects-atmosphere', order: 300 },
  { key: 'decorative-objects', title: 'Objetos decorativos', slug: 'objetos-decorativos', nodeType: 'collection', taxonomyAxis: 'piece_type', parentKey: 'objects-atmosphere', order: 400 },

  { key: 'emerald', title: 'Coleção Esmeralda', slug: 'colecao-esmeralda', nodeType: 'collection', taxonomyAxis: 'collection', parentKey: 'collections', order: 100 },
  { key: 'beige-bahia', title: 'Coleção Bege Bahia', slug: 'colecao-bege-bahia', nodeType: 'collection', taxonomyAxis: 'collection', parentKey: 'collections', order: 200 },
  { key: 'launches', title: 'Lançamentos', slug: 'lancamentos', nodeType: 'collection', taxonomyAxis: 'campaign', parentKey: 'collections', order: 300 },
  { key: 'authorial-pieces', title: 'Peças autorais', slug: 'pecas-autorais', nodeType: 'collection', taxonomyAxis: 'campaign', parentKey: 'collections', order: 400 },

  { key: 'new', title: 'Novidades', slug: 'novidades', nodeType: 'collection', taxonomyAxis: 'campaign', listingMode: 'rules', parentKey: 'ready', order: 100 },
  { key: 'last-units', title: 'Últimas unidades', slug: 'ultimas-unidades', nodeType: 'collection', taxonomyAxis: 'campaign', listingMode: 'assigned', parentKey: 'ready', order: 200 },

  { key: 'how-it-works', title: 'Como funciona', slug: 'como-funciona', nodeType: 'editorial', taxonomyAxis: 'service', parentKey: 'made-to-order', description: 'Informações sobre o processo de peças sob encomenda.', order: 100 },
  { key: 'made-pieces', title: 'Peças disponíveis sob encomenda', slug: 'pecas-sob-encomenda', nodeType: 'collection', taxonomyAxis: 'service', listingMode: 'rules', availability: ['made_to_order'], parentKey: 'made-to-order', order: 200 },
  { key: 'stone-customization', title: 'Personalização de pedras', slug: 'personalizacao-de-pedras', nodeType: 'editorial', taxonomyAxis: 'service', parentKey: 'made-to-order', description: 'Informações sobre possibilidades de personalização de pedras.', order: 300 },
  { key: 'measure-customization', title: 'Personalização de medidas', slug: 'personalizacao-de-medidas', nodeType: 'editorial', taxonomyAxis: 'service', parentKey: 'made-to-order', description: 'Informações sobre possibilidades de personalização de medidas.', order: 400 },
  { key: 'finishes', title: 'Acabamentos', slug: 'acabamentos', nodeType: 'editorial', taxonomyAxis: 'service', parentKey: 'made-to-order', description: 'Informações sobre acabamentos disponíveis.', order: 500 },
  { key: 'production-time', title: 'Prazos de produção', slug: 'prazos-de-producao', nodeType: 'editorial', taxonomyAxis: 'service', parentKey: 'made-to-order', description: 'Informações sobre prazos de produção.', order: 600 },
  { key: 'quote', title: 'Solicitar orçamento', slug: 'solicitar-orcamento', nodeType: 'editorial', taxonomyAxis: 'service', parentKey: 'made-to-order', description: 'Página de orientação para solicitação de orçamento.', order: 700 },
  { key: 'talk', title: 'Falar com a Esméra', slug: 'falar-com-a-esmera', nodeType: 'editorial', taxonomyAxis: 'service', parentKey: 'made-to-order', description: 'Página de contato com a Esméra.', order: 800 },

  { key: 'about', title: 'Sobre a Esméra', slug: 'sobre-a-esmera', nodeType: 'editorial', taxonomyAxis: 'service', parentKey: 'about-root', description: 'Apresentação institucional da Esméra.', order: 100 },
  { key: 'authorial-design', title: 'Design autoral', slug: 'design-autoral', nodeType: 'editorial', taxonomyAxis: 'service', parentKey: 'about-root', description: 'Página institucional sobre design autoral.', order: 200 },
  { key: 'process-material', title: 'Processo e matéria', slug: 'processo-e-materia', nodeType: 'editorial', taxonomyAxis: 'service', parentKey: 'about-root', description: 'Página institucional sobre processo e matéria.', order: 300 },
  { key: 'natural-stones', title: 'Pedras naturais', slug: 'pedras-naturais', nodeType: 'editorial', taxonomyAxis: 'service', parentKey: 'about-root', description: 'Página institucional sobre pedras naturais.', order: 400 },
  { key: 'handmade', title: 'Feito à mão', slug: 'feito-a-mao', nodeType: 'editorial', taxonomyAxis: 'service', parentKey: 'about-root', description: 'Página institucional sobre o fazer manual.', order: 500 },
  { key: 'care', title: 'Cuidados com as peças', slug: 'cuidados-com-as-pecas', nodeType: 'editorial', taxonomyAxis: 'service', parentKey: 'about-root', description: 'Orientações de cuidados com as peças.', order: 600 },
  { key: 'faq', title: 'Dúvidas frequentes', slug: 'duvidas-frequentes', nodeType: 'editorial', taxonomyAxis: 'service', parentKey: 'about-root', description: 'Perguntas e respostas frequentes.', order: 700 },
  { key: 'contact', title: 'Contato', slug: 'contato', nodeType: 'editorial', taxonomyAxis: 'service', parentKey: 'about-root', description: 'Canais oficiais de contato.', order: 800 },
]

function depthOf(node: SeedNode, byKey: Map<string, SeedNode>) {
  let depth = 0
  let current = node
  const visited = new Set<string>()
  while (current.parentKey) {
    if (visited.has(current.key)) throw new Error(`Ciclo no seed: ${current.key}`)
    visited.add(current.key)
    const parent = byKey.get(current.parentKey)
    if (!parent) throw new Error(`Pai ausente no seed: ${current.parentKey}`)
    depth += 1
    current = parent
  }
  return depth
}

async function main() {
  const payload = await getPayload({ config })
  const byKey = new Map(nodes.map((node) => [node.key, node]))
  const ids = new Map<string, string | number>()
  const created = new Set<string>()
  const conflicts: string[] = []

  const existing = await payload.find({
    collection: 'categories',
    depth: 0,
    draft: true,
    limit: 1000,
    pagination: false,
    overrideAccess: true,
    where: { slug: { in: nodes.map((node) => node.slug) } },
    select: { id: true, slug: true, title: true, status: true, _status: true },
  })
  const existingBySlug = new Map((existing.docs as ExistingCategory[]).map((category) => [category.slug || '', category]))

  for (const node of [...nodes].sort((left, right) => depthOf(left, byKey) - depthOf(right, byKey) || left.order - right.order)) {
    const found = existingBySlug.get(node.slug)
    if (found) {
      ids.set(node.key, found.id)
      if (found.status !== 'active' || found._status !== 'published') conflicts.push(`${node.slug}: existente, mas não está ativa e publicada`)
      continue
    }

    const parent = node.parentKey ? ids.get(node.parentKey) : null
    if (node.parentKey && parent === undefined) throw new Error(`Pai ainda não resolvido: ${node.parentKey}`)
    const category = await payload.create({
      collection: 'categories',
      draft: true,
      depth: 0,
      overrideAccess: true,
      data: {
        title: node.title,
        slug: node.slug,
        status: 'active',
        nodeType: node.nodeType,
        taxonomyAxis: node.taxonomyAxis,
        parent,
        order: node.order,
        description: node.description,
        menu: { showInMenu: true, label: node.title, visibility: 'all' },
        listingMode: node.listingMode || 'assigned',
        listingRules: node.availability || node.key === 'new'
          ? { availability: node.availability || [], productStatus: ['active'], sort: node.key === 'new' ? 'newest' : 'editorial' }
          : undefined,
        collectionPage: {
          visibleFilters: ['category', 'collection', 'environment', 'piece_type', 'material', 'availability', 'price'],
          defaultSort: node.key === 'new' ? 'newest' : 'editorial',
          productsPerPage: 24,
          showProductCount: true,
          layout: 'grid',
        },
        hubPath: node.hubPath,
        _status: 'draft',
      } as never,
    })
    ids.set(node.key, category.id)
    created.add(node.key)
  }

  for (const node of [...nodes].sort((left, right) => depthOf(right, byKey) - depthOf(left, byKey) || left.order - right.order)) {
    if (!created.has(node.key)) continue
    const id = ids.get(node.key)
    if (id === undefined) throw new Error(`ID ausente após criação: ${node.key}`)
    await payload.update({
      collection: 'categories',
      id,
      draft: false,
      depth: 0,
      overrideAccess: true,
      data: { _status: 'published' } as never,
    })
  }

  const rootKeys = ['pieces', 'collections', 'ready', 'made-to-order', 'about-root']
  const roots = rootKeys.map((key, index) => {
    const category = ids.get(key)
    if (category === undefined) throw new Error(`Raiz não resolvida: ${key}`)
    return {
      category,
      order: (index + 1) * 100,
      desktopMode: key === 'ready' ? 'link' : 'mega',
      mobileMode: 'drilldown',
      highlightLimit: 2,
    }
  })

  await payload.updateGlobal({
    slug: 'navigation',
    draft: false,
    depth: 0,
    overrideAccess: true,
    data: { roots } as never,
  })

  payload.logger.info({
    event: 'catalog-taxonomy.seed.completed',
    created: created.size,
    reused: nodes.length - created.size,
    conflicts,
    roots: rootKeys.length,
  })
  if (conflicts.length) {
    throw new Error(`Seed concluído sem sobrescrever ${conflicts.length} registro(s) conflitante(s): ${conflicts.join('; ')}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
