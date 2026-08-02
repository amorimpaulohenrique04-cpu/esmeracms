import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync } from 'node:fs'
import path from 'node:path'

function connection(value: string) {
  const url = new URL(value)
  return {
    host: url.hostname,
    port: url.port || '5432',
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    sslmode: url.searchParams.get('sslmode') || undefined,
  }
}

const databaseURL = process.env.DATABASE_URL
if (!databaseURL) throw new Error('DATABASE_URL não configurada.')

const now = new Date().toISOString().replace(/[:.]/g, '-')
const output = path.resolve(process.argv[2] || `backups/esmera-${now}.dump`)
mkdirSync(path.dirname(output), { recursive: true })

const target = connection(databaseURL)
const executable = process.env.PG_DUMP_BIN || 'pg_dump'
const result = spawnSync(executable, [
  '--host', target.host,
  '--port', target.port,
  '--username', target.user,
  '--dbname', target.database,
  '--format', 'custom',
  '--compress', '9',
  '--no-owner',
  '--no-privileges',
  '--file', output,
], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PGPASSWORD: target.password,
    ...(target.sslmode ? { PGSSLMODE: target.sslmode } : {}),
  },
})

if (result.error) throw result.error
if (result.status !== 0) throw new Error(`pg_dump encerrou com código ${result.status}.`)

try {
  chmodSync(output, 0o600)
} catch {
  // Windows and some mounted filesystems do not expose POSIX permissions.
}

console.info(`Backup PostgreSQL criado em ${output}`)
