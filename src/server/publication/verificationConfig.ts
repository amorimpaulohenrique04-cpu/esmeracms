import { PublicationVerificationRequiredError } from './types'

export type PublicationVerificationConfig = {
  enabled: boolean
  rollbackEnabled: boolean
  probeURL: string
  probeToken: string
}

function enabled(value: string | undefined, fallback: boolean) {
  if (value === undefined || value.trim() === '') return fallback
  return value.trim().toLowerCase() === 'true'
}

export function getPublicationVerificationConfig(
  env: NodeJS.ProcessEnv = process.env,
): PublicationVerificationConfig {
  return {
    enabled: enabled(env.PUBLICATION_VERIFICATION_ENABLED, true),
    rollbackEnabled: enabled(env.PUBLICATION_ROLLBACK_ENABLED, false),
    probeURL: env.STOREFRONT_PROBE_URL?.trim() || '',
    probeToken: env.STOREFRONT_PROBE_TOKEN?.trim() || env.ESMERA_RENDERABILITY_TOKEN?.trim() || '',
  }
}

export function assertPublicationVerificationConfigured(
  config: PublicationVerificationConfig,
): PublicationVerificationConfig {
  if (!config.enabled) {
    throw new PublicationVerificationRequiredError(
      'A verificação da vitrine está desativada. Entidades públicas não podem ser publicadas silenciosamente.',
    )
  }
  if (!config.probeURL || !config.probeToken) {
    throw new PublicationVerificationRequiredError(
      'A URL e o token do probe da Deco precisam estar configurados antes da publicação.',
    )
  }
  return config
}
