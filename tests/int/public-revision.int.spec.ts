import { describe, expect, it } from 'vitest'

import { Categories } from '../../src/collections/Categories'
import { Products } from '../../src/collections/Products'
import { Home } from '../../src/globals/Home'

function fieldNames(fields: unknown[]): string[] {
  return fields.flatMap((field) => {
    if (!field || typeof field !== 'object') return []
    const name = 'name' in field && typeof field.name === 'string' ? [field.name] : []
    return name
  })
}

// Os cenários de persistência, acesso público, backfill e recursão exigem Postgres.
// Este arquivo mantém uma verificação de integração de configuração que pode ser
// executada sem banco; a matriz com banco roda no pipeline que fornece DATABASE_URL.
describe('configuração integrada da revisão pública', () => {
  it('Product, Category e Home expõem os metadados gerados pelo servidor', () => {
    for (const fields of [Products.fields, Categories.fields, Home.fields]) {
      const names = fieldNames(fields as unknown[])
      expect(names).toContain('publicationRevision')
      expect(names).toContain('publicationContractVersion')
    }
  })

  it('Home registra somente o hook oficial após a mudança', () => {
    expect(Home.hooks?.afterChange).toBeDefined()
    expect(Home.hooks?.beforeChange).toBeUndefined()
  })
})
