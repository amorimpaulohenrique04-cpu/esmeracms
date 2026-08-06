from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(relative: str, old: str, new: str) -> None:
    path = ROOT / relative
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{relative}: expected one match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'src/server/domain/sales/opportunityWorkflow.ts',
    '''export type SaleWorkflowItem = {
  product: string | number
  variantSku?: string | null
  unitPriceCents?: number | null
  quantity: number
}

export type MoveOpportunityInput = {''',
    '''export type SaleWorkflowItem = {
  product: string | number
  variantSku?: string | null
  unitPriceCents?: number | null
  quantity: number
}

export type CreateSaleInput = {
  customerID: string | number
  items: SaleWorkflowItem[]
}

export type MoveOpportunityInput = {''',
)

replace_once(
    'src/server/domain/sales/opportunityWorkflow.ts',
    '''export async function winOpportunity(payload: Payload, user: WorkflowUser, input: WinOpportunityInput) {''',
    '''export async function createSale(payload: Payload, user: WorkflowUser, input: CreateSaleInput) {
  if (input.customerID === undefined || input.customerID === null || String(input.customerID).trim() === '') {
    throw new Error('Selecione o cliente da venda.')
  }
  if (!input.items.length) throw new Error('Confirme ao menos um item para criar a venda.')
  if (input.items.some((item) => !item.product || !Number.isInteger(item.quantity) || item.quantity < 1)) {
    throw new Error('Todos os itens precisam de produto e quantidade inteira maior que zero.')
  }

  return await withTransaction(payload, user, async (req) => {
    const sale = await payload.create({
      collection: 'sales',
      overrideAccess: false,
      user: user as never,
      req,
      data: {
        number: saleNumber(),
        customer: input.customerID,
        channel: 'whatsapp',
        status: 'confirmed',
        owner: user?.id,
        items: input.items.map((item) => ({
          product: item.product,
          variantSku: item.variantSku?.trim() || null,
          unitPriceCents: typeof item.unitPriceCents === 'number' ? item.unitPriceCents : null,
          quantity: item.quantity,
        })),
        discountCents: 0,
        shippingCents: 0,
      } as never,
    })

    await payload.create({
      collection: 'activities',
      overrideAccess: false,
      user: user as never,
      req,
      data: {
        eventType: 'sale.created',
        kind: 'sale',
        occurredAt: new Date().toISOString(),
        summary: `Venda ${sale.number} criada manualmente`,
        details: typeof sale.totalCents === 'number'
          ? `Total confirmado: ${(sale.totalCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`
          : undefined,
        owner: user?.id,
        relatedTo: [
          { relationTo: 'sales', value: sale.id },
          { relationTo: 'customers', value: input.customerID },
        ],
      } as never,
    })

    return { sale }
  })
}

export async function winOpportunity(payload: Payload, user: WorkflowUser, input: WinOpportunityInput) {''',
)

replace_once(
    'src/app/(payload)/api/admin-sales/route.ts',
    '''  bulkMoveOpportunities,
  loseOpportunity,''',
    '''  bulkMoveOpportunities,
  createSale,
  loseOpportunity,''',
)
replace_once(
    'src/app/(payload)/api/admin-sales/route.ts',
    "type SalesAction = 'move-stage' | 'reorder-stage' | 'bulk-stage' | 'win' | 'lose'",
    "type SalesAction = 'move-stage' | 'reorder-stage' | 'bulk-stage' | 'create' | 'win' | 'lose'",
)
replace_once(
    'src/app/(payload)/api/admin-sales/route.ts',
    '''  channel?: string
  items?: SaleWorkflowItem[]''',
    '''  channel?: string
  customerID?: string | number
  items?: SaleWorkflowItem[]''',
)
replace_once(
    'src/app/(payload)/api/admin-sales/route.ts',
    "    if (body.action === 'lose') {",
    '''    if (body.action === 'create') {
      if (body.customerID === undefined || body.customerID === null || !Array.isArray(body.items)) {
        return NextResponse.json({ error: 'Cliente e itens são obrigatórios.' }, { status: 400 })
      }
      return NextResponse.json(await createSale(payload, user, {
        customerID: body.customerID,
        items: body.items,
      }))
    }

    if (body.action === 'lose') {''',
)

replace_once(
    'src/app/(payload)/api/admin-customers/handler.ts',
    'export async function POST(request: Request) {',
    '''export async function GET(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!canManageBusiness(user)) return NextResponse.json({ error: 'Sem permissão para consultar clientes.' }, { status: 403 })

  const query = new URL(request.url).searchParams.get('q')?.trim().slice(0, 80) || ''
  if (query.length < 2) return NextResponse.json({ docs: [] })

  const result = await payload.find({
    collection: 'customers',
    depth: 0,
    limit: 8,
    pagination: false,
    overrideAccess: false,
    user,
    where: {
      or: [
        { name: { like: query } },
        { company: { like: query } },
        { phone: { like: query } },
      ],
    } as Where,
    select: { id: true, name: true, company: true, phone: true },
  })

  return NextResponse.json({
    docs: result.docs.map((customer) => ({
      id: customer.id,
      name: customer.name,
      company: customer.company,
      phone: customer.phone,
    })),
  })
}

export async function POST(request: Request) {''',
)
replace_once(
    'src/app/(payload)/api/admin-customers/route.ts',
    "export { POST } from './handler'",
    "export { GET, POST } from './handler'",
)

replace_once(
    'src/app/(payload)/api/admin-categories/route.ts',
    "type CategoryAction = 'save-draft' | 'save-and-publish' | 'publish' | 'unpublish' | 'reorder'",
    "type CategoryAction = 'create' | 'save-draft' | 'save-and-publish' | 'publish' | 'unpublish' | 'reorder'",
)
replace_once(
    'src/app/(payload)/api/admin-categories/route.ts',
    "  if (body.action === 'save-draft') {",
    '''  if (body.action === 'create') {
    const data = categoryDraftData(body.data)
    const title = String(data.title || '').trim()
    if (!title) return adminInputError('Informe o nome da categoria.')

    try {
      const category = await payload.create({
        collection: 'categories',
        data: {
          title,
          parent: data.parent ?? null,
          status: data.status || 'active',
          _status: 'draft',
        } as never,
        draft: true,
        depth: 0,
        overrideAccess: false,
        user,
      })
      return NextResponse.json({ id: category.id, created: 1 })
    } catch (error) {
      return adminErrorResponse(error, {
        entity: 'category',
        operation: 'create',
        logger: payload.logger,
      })
    }
  }

  if (body.action === 'save-draft') {''',
)

print('Backend patch applied.')
