import 'dotenv/config'

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
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

const sourceURL = process.env.DATABASE_URL
const restoreURL = process.env.RESTORE_TEST_DATABASE_URL
const archive = path.resolve(process.argv[2] || '')

if (!sourceURL) throw new Error('DATABASE_URL não configurada.')
if (!restoreURL) throw new Error('RESTORE_TEST_DATABASE_URL não configurada.')
if (!process.argv[2] || !existsSync(archive)) throw new Error('Informe o caminho de um backup .dump existente.')

const source = connection(sourceURL)
const target = connection(restoreURL)
if (source.host === target.host && source.port === target.port && source.database === target.database) {
  throw new Error('A restauração de teste não pode usar o mesmo banco definido em DATABASE_URL.')
}

const executable = process.env.PG_RESTORE_BIN || 'pg_restore'
const environment = {
  ...process.env,
  PGPASSWORD: target.password,
  ...(target.sslmode ? { PGSSLMODE: target.sslmode } : {}),
}

const list = spawnSync(executable, ['--list', archive], { stdio: 'inherit', env: environment })
if (list.error) throw list.error
if (list.status !== 0) throw new Error(`O arquivo de backup é inválido; pg_restore --list encerrou com código ${list.status}.`)

const result = spawnSync(executable, [
  '--host', target.host,
  '--port', target.port,
  '--username', target.user,
  '--dbname', target.database,
  '--clean',
  '--if-exists',
  '--no-owner',
  '--no-privileges',
  '--exit-on-error',
  archive,
], { stdio: 'inherit', env: environment })

if (result.error) throw result.error
if (result.status !== 0) throw new Error(`pg_restore encerrou com código ${result.status}.`)

console.info(`Restauração de teste concluída no banco ${target.database}.`)
