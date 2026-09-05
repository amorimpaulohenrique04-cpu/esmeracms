export type PostgresConnectionMode = 'direct' | 'session-pooler' | 'transaction-pooler' | 'custom'

export type PostgresConnection = {
  database: string
  hostname: string
  mode: PostgresConnectionMode
  port: string
  targetKey: string
  url: string
  username: string
}

function invalid(name: string, reason: string): never {
  throw new Error(`${name} inválida: ${reason}`)
}

function decode(value: string, name: string, field: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return invalid(name, `${field} possui percent-encoding inválido.`)
  }
}

export function parsePostgresConnection(value: string | undefined, name = 'DATABASE_URL'): PostgresConnection {
  const raw = value?.trim()
  if (!raw) invalid(name, 'variável ausente ou vazia.')

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return invalid(name, 'use uma URL PostgreSQL válida e percent-encode caracteres especiais da senha.')
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    invalid(name, 'o protocolo deve ser postgres:// ou postgresql://.')
  }

  const username = decode(parsed.username, name, 'username')
  const password = decode(parsed.password, name, 'senha')
  const database = parsed.pathname.replace(/^\//, '')
  const hostname = parsed.hostname.toLowerCase()
  const port = parsed.port || '5432'

  if (!username) invalid(name, 'username ausente.')
  if (!password) invalid(name, 'senha ausente.')
  if (!hostname) invalid(name, 'host ausente.')
  if (!database) invalid(name, 'database ausente.')

  const isSupabasePooler = hostname.endsWith('.pooler.supabase.com')
  const directMatch = hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/)
  let mode: PostgresConnectionMode = 'custom'

  if (isSupabasePooler) {
    if (!/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(hostname)) {
      invalid(name, 'host do Supabase Pooler não corresponde ao formato oficial do painel.')
    }
    if (!/^postgres\.[a-z0-9]{20}$/.test(username)) {
      invalid(name, 'Session/Transaction Pooler exige username postgres.PROJECT_REF.')
    }
    if (!['5432', '6543'].includes(port)) {
      invalid(name, 'Session Pooler usa porta 5432; Transaction Pooler usa 6543.')
    }
    mode = port === '6543' ? 'transaction-pooler' : 'session-pooler'
  } else if (directMatch) {
    if (username !== 'postgres') invalid(name, 'conexão Direct exige username postgres.')
    if (port !== '5432') invalid(name, 'conexão Direct usa porta 5432.')
    mode = 'direct'
  }

  const sslmode = parsed.searchParams.get('sslmode') || ''
  if ((isSupabasePooler || directMatch) && !['require', 'verify-ca', 'verify-full'].includes(sslmode)) {
    invalid(name, 'conexões Supabase devem declarar sslmode=require, verify-ca ou verify-full.')
  }
  if ((isSupabasePooler || directMatch) && sslmode === 'require' && parsed.searchParams.get('uselibpqcompat') !== 'true') {
    invalid(name, 'sslmode=require com pg 8.x exige uselibpqcompat=true; prefira verify-full com a CA do Supabase.')
  }
  if ((isSupabasePooler || directMatch) && ['verify-ca', 'verify-full'].includes(sslmode) && !parsed.searchParams.get('sslrootcert')) {
    invalid(name, `${sslmode} exige sslrootcert apontando para a CA oficial do Supabase.`)
  }

  return {
    database,
    hostname,
    mode,
    port,
    targetKey: `${hostname}:${port}/${database}#${username}`,
    url: raw,
    username,
  }
}

export function resolveRuntimeDatabaseURL(
  value: string | undefined,
  environment = process.env.NODE_ENV,
): string {
  const connection = parsePostgresConnection(value)

  // Supabase Session Pooler (5432) keeps one backend session per client and is
  // inappropriate for horizontally scaled serverless runtimes such as Vercel.
  // Reuse the same credentials/host through the Transaction Pooler (6543),
  // which multiplexes short-lived clients and avoids exhausting client slots.
  if (environment === 'production' && connection.mode === 'session-pooler') {
    const transactionURL = new URL(connection.url)
    transactionURL.port = '6543'
    return transactionURL.toString()
  }

  return connection.url
}

export function requireDatabaseURL(): string {
  return resolveRuntimeDatabaseURL(process.env.DATABASE_URL)
}
