export type Relation<T extends { id: string | number }> = T | string | number | null | undefined

export type OpportunityRef = {
  id: string | number
  code?: string | null
  stage?: string | null
}

export type LeadRecord = {
  id: string | number
  name?: string | null
  phone?: string | null
  email?: string | null
  source?: string | null
  notes?: string | null
  opportunity?: Relation<OpportunityRef>
  createdAt?: string | null
  updatedAt?: string | null
}

export type LeadFilters = {
  q: string
}
