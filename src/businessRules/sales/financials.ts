export type SaleFinancialItem = {
  priceMode?: string | null
  unitPriceCents?: number | null
  quantity?: number | null
}

export type SaleFinancialInput = {
  items?: SaleFinancialItem[] | null
  discountCents?: number | null
  shippingCents?: number | null
}

export type SaleFinancialResult = {
  subtotalCents: number | null
  totalCents: number | null
  issues: string[]
}

const validCents = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0

export function calculateSaleFinancials(input: SaleFinancialInput): SaleFinancialResult {
  const issues: string[] = []
  const items = input.items || []
  const discount = input.discountCents ?? 0
  const shipping = input.shippingCents ?? 0

  if (!validCents(discount)) issues.push('O desconto deve ser um número inteiro não negativo em centavos.')
  if (!validCents(shipping)) issues.push('O frete deve ser um número inteiro não negativo em centavos.')

  let subtotal = 0
  let hasUnknownPrice = false
  items.forEach((item, index) => {
    const quantity = item.quantity ?? 1
    if (!Number.isInteger(quantity) || quantity < 1) issues.push(`O item ${index + 1} deve possuir quantidade inteira maior ou igual a 1.`)
    if (!validCents(item.unitPriceCents)) {
      hasUnknownPrice = true
      if (item.priceMode === 'fixed') issues.push(`O item ${index + 1} está com preço fixo sem valor unitário válido.`)
      return
    }
    subtotal += item.unitPriceCents * quantity
  })

  if (issues.length || hasUnknownPrice) return { subtotalCents: null, totalCents: null, issues }

  const total = subtotal - discount + shipping
  if (total < 0) {
    issues.push('O desconto não pode gerar total negativo.')
    return { subtotalCents: subtotal, totalCents: null, issues }
  }

  return { subtotalCents: subtotal, totalCents: total, issues }
}
