const DECO_HOSTS = new Set(['deco.cx', 'deco.site'])

function isDecoHost(hostname: string) {
  return [...DECO_HOSTS].some((host) => hostname === host || hostname.endsWith(`.${host}`))
}

export function parseDecoCorsOrigins(value: string | undefined): string[] {
  if (!value?.trim()) return []

  const origins = value.split(',').map((origin) => origin.trim()).filter(Boolean)

  return [...new Set(origins.map((origin) => {
    if (origin.includes('*')) throw new Error('DECO_CORS_ORIGINS não aceita curingas.')

    let parsed: URL
    try {
      parsed = new URL(origin)
    } catch {
      throw new Error(`DECO_CORS_ORIGINS contém uma origem inválida: ${origin}`)
    }

    if (parsed.protocol !== 'https:') throw new Error('DECO_CORS_ORIGINS aceita somente origens HTTPS.')
    if (!isDecoHost(parsed.hostname.toLowerCase())) {
      throw new Error('DECO_CORS_ORIGINS aceita somente domínios exatos da deco.cx ou deco.site.')
    }
    if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error('DECO_CORS_ORIGINS deve conter apenas origens, sem credenciais, caminho, query ou hash.')
    }

    return parsed.origin
  }))]
}
