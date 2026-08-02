export type CommercialRankingRow = {
  revenueCents: number
  opportunitiesCreated: number
  ownerName: string
}

export function compareCommercialRanking(a: CommercialRankingRow, b: CommercialRankingRow) {
  if (a.revenueCents !== b.revenueCents) return b.revenueCents - a.revenueCents
  if (a.opportunitiesCreated !== b.opportunitiesCreated) return b.opportunitiesCreated - a.opportunitiesCreated
  return a.ownerName.localeCompare(b.ownerName, 'pt-BR')
}

export function sortCommercialRanking<T extends CommercialRankingRow>(rows: T[]): T[] {
  return [...rows].sort(compareCommercialRanking)
}
