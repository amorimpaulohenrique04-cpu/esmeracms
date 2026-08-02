import { describe, expect, it } from 'vitest'

import { parsePostgresConnection } from '@/server/env/postgres'

describe('Postgres environment contract', () => {
  it('accepts a complete Supabase Session Pooler URL', () => {
    const result = parsePostgresConnection(
      'postgresql://postgres.abcdefghijklmnopqrst:p%23ss@aws-0-us-east-2.pooler.supabase.com:5432/postgres?sslmode=verify-full&sslrootcert=certs%2Fsupabase-prod-ca-2021.crt',
    )

    expect(result.mode).toBe('session-pooler')
    expect(result.database).toBe('postgres')
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
