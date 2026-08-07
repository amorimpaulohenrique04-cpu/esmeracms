import type { PublicationIssue } from '../publication/types'

export const STOREFRONT_CONTRACT_VERSION = '1' as const
export const storefrontKinds = ['product', 'category', 'home', 'navigation', 'site-settings'] as const

export type StorefrontKind = (typeof storefrontKinds)[number]

export type StorefrontContractEnvelope<T extends Record<string, unknown> = Record<string, unknown>> = {
  contractVersion: typeof STOREFRONT_CONTRACT_VERSION
  kind: StorefrontKind
  data: T
  meta?: {
    publishedAt?: string | null
    source?: 'payload' | 'deco_baseline'
    revision?: string | null
  }
}

export type StorefrontContractDiagnostic = PublicationIssue

export type StorefrontContractValidation = {
  contractVersion: typeof STOREFRONT_CONTRACT_VERSION
  compatible: boolean
  status: 'compatible' | 'partial' | 'incompatible'
  issues: StorefrontContractDiagnostic[]
}
export * from '../storefront-v2/types'
