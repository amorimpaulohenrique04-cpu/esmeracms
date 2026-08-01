export type QueryFilterState = Record<string, unknown>

export const adminQueryKeys = {
  products: (filters: QueryFilterState = {}) => ['products', filters] as const,
  customer: (id: string | number) => ['customer', String(id)] as const,
  sales: (filters: QueryFilterState = {}) => ['sales', filters] as const,
  afterSales: (filters: QueryFilterState = {}) => ['after-sales', filters] as const,
  reports: (filters: QueryFilterState = {}) => ['reports', filters] as const,
}

export type AdminQueryKey = ReturnType<(typeof adminQueryKeys)[keyof typeof adminQueryKeys]>
