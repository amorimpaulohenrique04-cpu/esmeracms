import { describe, expect, it } from 'vitest'

import { parsePostgresConnection, resolveRuntimeDatabaseURL } from '@/server/env/postgres'

const sessionPoolerURL =
  'postgresql://postgres.abcdefghijklmnopqrst:p%23ss@aws-0-us-east-2.pooler.supabase.com:5432/postgres?sslmode=verify-full&sslrootcert=certs%2Fsupabase-prod-ca-2021.crt'

describe('Postgres environment contract', () => {
  it('accepts a complete Supabase Session Pooler URL', () => {
    const result = parsePostgresConnection(sessionPoolerURL)

    expect(result.mode).toBe('session-pooler')
    expect(result.database).toBe('postgres')
  })

  it('rewrites Supabase Session Pooler to Transaction Pooler in production runtime', () => {
    const runtimeURL = resolveRuntimeDatabaseURL(sessionPoolerURL, 'production')
    const result = parsePostgresConnection(runtimeURL)

    expect(result.mode).toBe('transaction-pooler')
    expect(result.port).toBe('6543')
    expect(result.hostname).toBe('aws-0-us-east-2.pooler.supabase.com')
    expect(result.username).toBe('postgres.abcdefghijklmnopqrst')
  })

  it('keeps Session Pooler unchanged outside production runtime', () => {
    const runtimeURL = resolveRuntimeDatabaseURL(sessionPoolerURL, 'development')
    expect(parsePostgresConnection(runtimeURL).mode).toBe('session-pooler')
  })

  it('does not rewrite an already configured Transaction Pooler URL', () => {
    const transactionURL = sessionPoolerURL.replace(':5432/', ':6543/')
    expect(resolveRuntimeDatabaseURL(transactionURL, 'production')).toBe(transactionURL)
  })

  it('rejects mixing Pooler host with Direct username', () => {
    expect(() => parsePostgresConnection(
      'postgresql://postgres:secret@aws-0-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require',
    )).toThrow('postgres.PROJECT_REF')
  })

  it('rejects mixing Direct host with Pooler username', () => {
    expect(() => parsePostgresConnection(
      'postgresql://postgres.abcdefghijklmnopqrst:secret@db.abcdefghijklmnopqrst.supabase.co:5432/postgres?sslmode=require',
    )).toThrow('conexão Direct exige username postgres')
  })

  it('requires SSL mode for Supabase connections', () => {
    expect(() => parsePostgresConnection(
      'postgresql://postgres.abcdefghijklmnopqrst:secret@aws-0-us-east-2.pooler.supabase.com:5432/postgres',
    )).toThrow('sslmode=require')
  })

  it('requires a CA certificate for verify-full', () => {
    expect(() => parsePostgresConnection(
      'postgresql://postgres.abcdefghijklmnopqrst:secret@aws-0-us-east-2.pooler.supabase.com:5432/postgres?sslmode=verify-full',
    )).toThrow('sslrootcert')
  })
})
