export type Relation<T extends { id: string | number }> = T | string | number | null | undefined

export type OpportunityRef = {
  id: string | number
  code?: string | null
  stage?: string | null
}

export type InterestedProductRef = {
  id: string | number
  title?: string | null
  code?: string | null
  slug?: string | null
  material?: string | null
  availability?: string | null
  basePriceCents?: number | null
  priceMode?: string | null
}

export type LeadRecord = {
  id: string | number
  name?: string | null
  phone?: string | null
  email?: string | null
  source?: string | null
  notes?: string | null
  opportunity?: Relation<OpportunityRef>
  interestedProducts?: Array<Relation<InterestedProductRef>> | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type LeadFilters = {
  q: string
}
