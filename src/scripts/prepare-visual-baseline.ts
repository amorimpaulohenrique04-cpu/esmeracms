import fs from 'node:fs/promises'
import path from 'node:path'

import { getPayload, type Payload } from 'payload'

import config from '../payload.config'
import {
  adminBaselineRouteNames,
  baselineViewports,
  expectedTotalPngs,
  interactionScreenshotNames,
  privacyBaselineRouteNames,
  type BaselineFixtureMap,
  type VisualBaselineManifest,
  VISUAL_FIXED_TIME,
} from '../visual-baseline/contract'

const root = process.cwd()
const outputDir = path.join(root, 'artifacts', 'admin-baseline')
const fixtureMapPath = path.join(outputDir, 'fixture-map.json')
const manifestPath = path.join(outputDir, 'baseline-manifest.json')
const datasetVersion = process.env.VISUAL_DATASET_VERSION || 'stage23-v2'
const databaseURL = process.env.DATABASE_URL || ''
const explicitLocalReset = process.env.ALLOW_VISUAL_DATA_RESET === 'true'
const runningInCI = process.env.CI === 'true'
const localDatabase = /(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(databaseURL)
const adminEmail = process.env.BASELINE_ADMIN_EMAIL || 'baseline.admin@esmera.local'
const adminPassword = process.env.BASELINE_ADMIN_PASSWORD || 'EsmeraBaseline-2026!'

const fixed = new Date(VISUAL_FIXED_TIME)
const hours = (value: number) => new Date(fixed.getTime() + value * 60 * 60 * 1000).toISOString()
const days = (value: number) => new Date(fixed.getTime() + value * 24 * 60 * 60 * 1000).toISOString()

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

async function resetDatabase(payload: Payload) {
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
}

async function seedDataset(payload: Payload): Promise<BaselineFixtureMap> {
  const admin = await payload.create({
    collection: 'users',
    overrideAccess: true,
    data: {
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
      name: 'Baseline Admin',
    },
  })

  const category = await payload.create({
    collection: 'categories',
    draft: true,
    overrideAccess: true,
    data: {
      title: 'Objetos Baseline',
      slug: 'objetos-baseline',
      status: 'active',
      order: 100,
      description: 'Categoria usada para validar o workspace master-detail.',
      searchTerms: [{ term: 'objetos especiais' }, { term: 'curadoria' }],
      seo: {
        title: 'Objetos Baseline · Esméra',
        description: 'Seleção editorial de objetos Esméra para o baseline visual.',
        noIndex: false,
      },
      _status: 'draft',
    } as never,
  })

  const product = await payload.create({
    collection: 'products',
    draft: true,
    overrideAccess: true,
    data: {
      title: 'Objeto Baseline Esméra',
      slug: 'objeto-baseline-esmera',
      code: 'BASE-001',
      catalogStatus: 'active',
      availability: 'unique',
      priceMode: 'fixed',
      basePriceCents: 145_000,
      material: 'Esmeralda bruta',
      edition: 'Peça única',
      categories: [category.id],
      _status: 'draft',
    } as never,
  })

  const customer = await payload.create({
    collection: 'customers',
    overrideAccess: true,
    data: {
      name: 'Mariana Lopes',
      company: 'Atelier Mariana',
      phone: '+5511998765432',
      email: 'mariana.baseline@example.com',
      origin: 'instagram',
      status: 'follow_up',
      owner: admin.id,
      tags: [{ value: 'colecionadora' }, { value: 'interiores' }],
      interestProfile: {
        categories: [category.id],
        materials: [{ value: 'esmeralda' }, { value: 'pedra natural' }],
        investmentMinCents: 100_000,
        investmentMaxCents: 500_000,
      },
    } as never,
  })

  const privacyCustomer = await payload.create({
    collection: 'customers',
    overrideAccess: true,
    data: {
      name: 'Cliente Privacidade Baseline',
      email: 'privacidade.baseline@example.com',
      status: 'follow_up',
      origin: 'site',
      owner: admin.id,
      marketingConsent: true,
      tags: [{ value: 'lgpd' }, { value: 'baseline' }],
    } as never,
  })

  const opportunity = await payload.create({
    collection: 'opportunities',
    overrideAccess: true,
    data: {
      customer: customer.id,
      source: 'instagram',
      stage: 'proposal',
      priority: 'high',
      owner: admin.id,
      interestedProducts: [product.id],
      estimatedValueCents: 145_000,
      nextAction: 'Enviar proposta revisada',
      nextActionAt: hours(24),
      expectedCloseAt: days(7),
    } as never,
  })

  const sale = await payload.create({
    collection: 'sales',
    overrideAccess: true,
    data: {
      number: 'BASE-SALE-001',
      customer: customer.id,
      opportunity: opportunity.id,
      channel: 'whatsapp',
      status: 'confirmed',
      owner: admin.id,
      nextAction: 'Confirmar endereço de entrega',
      nextActionAt: hours(12),
      items: [{ product: product.id, quantity: 1 }],
      discountCents: 0,
      shippingCents: 12_000,
      expectedDeliveryAt: days(7),
      deliveryMode: 'own_delivery',
    } as never,
  })

  const afterSale = await payload.create({
    collection: 'after-sales',
    overrideAccess: true,
    data: {
      sale: sale.id,
      customer: customer.id,
      status: 'following',
      priority: 'high',
      owner: admin.id,
      summary: 'Acompanhamento ativo da entrega e da experiência da cliente.',
      expectedDeliveryAt: days(7),
      incidentType: 'none',
    } as never,
  })

  const task = await payload.create({
    collection: 'tasks',
    overrideAccess: true,
    data: {
      title: 'Confirmar recebimento e integridade da peça',
      type: 'delivery_confirmation',
      status: 'pending',
      priority: 'high',
      dueAt: hours(24),
      assignee: admin.id,
      notes: 'Próxima ação real para o baseline visual.',
      relatedTo: [{ relationTo: 'after-sales', value: afterSale.id }],
    } as never,
  })

  const shipment = await payload.create({
    collection: 'shipments',
    overrideAccess: true,
    data: {
      afterSalesCase: afterSale.id,
      carrier: 'Entrega própria Esméra',
      trackingCode: 'ESM-TRACK-001',
      status: 'in_transit',
      estimatedDelivery: days(4),
      lastEvent: 'Peça em trânsito com acondicionamento conferido.',
    } as never,
  })

  const occurrence = await payload.create({
    collection: 'occurrences',
    overrideAccess: true,
    data: {
      afterSalesCase: afterSale.id,
      type: 'delivery_delay',
      severity: 'medium',
      status: 'open',
      owner: admin.id,
      description: 'Janela de entrega revisada com a cliente; acompanhamento em andamento.',
    } as never,
  })

  const interest = await payload.create({
    collection: 'client-interests',
    overrideAccess: true,
    data: {
      customer: customer.id,
      product: product.id,
      status: 'active',
      source: 'manual',
      owner: admin.id,
      notes: 'Interesse para composição de living.',
      addedAt: hours(-4),
    } as never,
  })

  await payload.create({
    collection: 'activities',
    overrideAccess: true,
    data: {
      eventType: 'interest.added',
      kind: 'contact',
      occurredAt: hours(-4),
      summary: 'Interesse adicionado: Objeto Baseline Esméra',
      details: 'Interesse para composição de living.',
      owner: admin.id,
      relatedTo: [
        { relationTo: 'customers', value: customer.id },
        { relationTo: 'client-interests', value: interest.id },
      ],
    } as never,
  })

  await payload.create({
    collection: 'activities',
    overrideAccess: true,
    data: {
      eventType: 'note.created',
      kind: 'note',
      occurredAt: hours(-2),
      summary: 'Nota sobre Mariana Lopes',
      details: 'Cliente prefere contato no período da tarde e curadoria com peças únicas.',
      owner: admin.id,
      relatedTo: [{ relationTo: 'customers', value: customer.id }],
    } as never,
  })

  return {
    datasetVersion,
    generatedAt: VISUAL_FIXED_TIME,
    adminUserId: admin.id,
    categoryId: category.id,
    productId: product.id,
    customerId: customer.id,
    privacyCustomerId: privacyCustomer.id,
    opportunityId: opportunity.id,
    saleId: sale.id,
    afterSaleId: afterSale.id,
    taskId: task.id,
    shipmentId: shipment.id,
    occurrenceId: occurrence.id,
    interestId: interest.id,
  }
}

async function writePreparationArtifacts(fixtures: BaselineFixtureMap) {
  await fs.rm(outputDir, { recursive: true, force: true })
  await fs.mkdir(outputDir, { recursive: true })

  const manifest: VisualBaselineManifest = {
    schemaVersion: 2,
    datasetVersion,
    source: 'prepare-visual-baseline',
    complete: false,
    expectedPngs: expectedTotalPngs,
    actualPngs: 0,
    preparedAt: new Date().toISOString(),
    commitSha: process.env.GITHUB_SHA || null,
    fixedTime: VISUAL_FIXED_TIME,
    platform: process.platform,
    nodeVersion: process.version,
    viewports: baselineViewports.map((viewport) => ({ ...viewport })),
    scenarios: {
      admin: [...adminBaselineRouteNames],
      privacy: [...privacyBaselineRouteNames],
      interaction: Object.fromEntries(
        baselineViewports.map((viewport) => [viewport.name, interactionScreenshotNames(viewport.width)]),
      ),
    },
    files: [],
  }

  await Promise.all([
    fs.writeFile(fixtureMapPath, `${JSON.stringify(fixtures, null, 2)}\n`, 'utf8'),
    fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
  ])
}

async function main() {
  assertIsolatedDatabase()
  const payload = await getPayload({ config: await config })

  try {
    await resetDatabase(payload)
    const fixtures = await seedDataset(payload)
    await writePreparationArtifacts(fixtures)
    console.log(`Dataset visual ${datasetVersion} preparado em banco isolado com ${expectedTotalPngs} capturas esperadas.`)
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
