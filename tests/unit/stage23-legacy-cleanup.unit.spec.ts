import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

async function exists(relativePath: string) {
  try {
    await fs.access(path.join(root, relativePath))
    return true
  } catch {
    return false
  }
}

async function walk(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(absolute) : [absolute]
  }))
  return nested.flat()
}

describe('Etapa 23 — limpeza do legado', () => {
  it('mantém views legadas removidas', async () => {
    const legacyPaths = [
      'src/admin/modules/content/ContentView.tsx',
      'src/admin/views/BusinessViews.tsx',
      'src/admin/views/Dashboard.tsx',
      'src/admin/views/SiteViews.tsx',
    ]

    await expect(Promise.all(legacyPaths.map(exists))).resolves.toEqual([false, false, false, false])
  })

  it('remove comportamento comercial ativo de Leads', async () => {
    const leads = await fs.readFile(path.join(root, 'src/collections/Leads.ts'), 'utf8')

    expect(leads).not.toContain('applyLeadRules')
    expect(leads).not.toContain('hooks:')
    expect(leads).toContain("description: 'Leads representam exclusivamente aquisição e qualificação")
    expect(leads).toContain("name: 'stage'")
    expect(leads).toContain('admin: { hidden: true }')
  })

  it('não mantém estilos compartilhados do Pipeline antigo', async () => {
    const styles = await fs.readFile(path.join(root, 'src/admin/views/views.scss'), 'utf8')

    expect(styles).not.toContain('.esmera-pipeline')
    expect(styles).not.toContain('.esmera-stage-track')
    expect(styles).not.toContain('.esmera-quality-list')
    expect(styles).not.toContain('.esmera-report-bar')
  })

  it('restringe leitura de followUps à compatibilidade de schema e migração', async () => {
    const files = await walk(path.join(root, 'src'))
    const readers: string[] = []

    for (const file of files.filter((item) => /\.(?:ts|tsx|js|jsx|mts|mjs)$/.test(item))) {
      const relative = path.relative(root, file).split(path.sep).join('/')
      if (relative === 'src/payload-types.ts') continue
      const content = await fs.readFile(file, 'utf8')
      if (/\bfollowUps\b/.test(content)) readers.push(relative)
    }

    expect(readers.sort()).toEqual([
      'src/collections/AfterSales.ts',
      'src/scripts/migrate-after-sales-followups.ts',
    ])
  })

  it('executa dead-code e bundle analysis no gate padrão', async () => {
    const packageJSON = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>
    }

    expect(packageJSON.scripts?.['analyze:dead-code']).toBeTruthy()
    expect(packageJSON.scripts?.['analyze:bundle']).toBeTruthy()
    expect(packageJSON.scripts?.validate).toContain('pnpm analyze:dead-code')
    expect(packageJSON.scripts?.validate).toContain('pnpm analyze:bundle')
  })
})
