import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const migrationDir = 'src/migrations'
const migrationName = readdirSync(migrationDir)
  .filter((name) => name.endsWith('_catalog_taxonomy_v2.ts'))
  .sort()
  .at(-1)

if (!migrationName) throw new Error('Migration catalog_taxonomy_v2 não encontrada.')

const migrationPath = join(migrationDir, migrationName)
const source = readFileSync(migrationPath, 'utf8')

const duplicateSchemaTokens = [
  'enum_home_disabled_sections',
  'enum__home_v_version_disabled_sections',
  'home_disabled_sections',
  '_home_v_version_disabled_sections',
  'footer_statement',
  'location_label',
  'privacy_label',
  'privacy_href',
  'terms_label',
  'terms_href',
]

const duplicatePublicationIndexes = new Set([
  'categories_publication_revision_idx',
  'products_publication_revision_idx',
  'home_publication_revision_idx',
])

function shouldRemove(statement) {
  if (duplicateSchemaTokens.some((token) => statement.includes(token))) return true

  const publicationColumnChange = /ALTER TABLE .*\b(?:ADD|DROP) COLUMN\b/.test(statement)
    && /"(?:publication_revision|publication_contract_version|version_publication_revision|version_publication_contract_version)"/.test(statement)
  if (publicationColumnChange) return true

  for (const index of duplicatePublicationIndexes) {
    if (statement.includes(`"${index}"`)) return true
  }
  return false
}

let removed = 0
const sanitizedSql = source.replace(/await db\.execute\(sql`([\s\S]*?)`\)/g, (match, sqlBody) => {
  const statements = sqlBody
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)
  const kept = statements.filter((statement) => {
    const remove = shouldRemove(statement)
    if (remove) removed += 1
    return !remove
  })
  return `await db.execute(sql\`\n  ${kept.join(';\n  ')};\`)`
})

const sanitized = sanitizedSql
  .replace(
    'export async function up({ db, payload, req }: MigrateUpArgs)',
    'export async function up({ db }: MigrateUpArgs)',
  )
  .replace(
    'export async function down({ db, payload, req }: MigrateDownArgs)',
    'export async function down({ db }: MigrateDownArgs)',
  )

if (sanitized !== source) {
  writeFileSync(migrationPath, sanitized)
  console.log(`Migration ${migrationName} sanitizada: ${removed} statement(s) redundante(s) removido(s).`)
} else {
  console.log(`Migration ${migrationName} já estava sanitizada.`)
}
