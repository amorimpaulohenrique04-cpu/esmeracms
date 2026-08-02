import fs from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const sourceRoot = path.join(root, 'src')
const artifactsRoot = path.join(root, 'artifacts')
const codeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs'])

function relative(file: string) {
  return path.relative(root, file).split(path.sep).join('/')
}

async function walk(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(absolute) : [absolute]
  }))
  return nested.flat()
}

function isGenerated(file: string) {
  const name = relative(file)
  return name === 'src/payload-types.ts' || name.endsWith('.d.ts')
}

function resolveImport(fromFile: string, specifier: string, fileSet: Set<string>) {
  let base: string
  if (specifier.startsWith('.')) base = path.resolve(path.dirname(fromFile), specifier)
  else if (specifier.startsWith('@/')) base = path.resolve(sourceRoot, specifier.slice(2))
  else return null

  const candidates = [
    base,
    ...Array.from(codeExtensions, (extension) => `${base}${extension}`),
    ...Array.from(codeExtensions, (extension) => path.join(base, `index${extension}`)),
  ]
  return candidates.find((candidate) => fileSet.has(candidate)) || null
}

function importSpecifiers(source: ts.SourceFile) {
  const values: string[] = []
  const visit = (node: ts.Node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier
      && ts.isStringLiteralLike(node.moduleSpecifier)) {
      values.push(node.moduleSpecifier.text)
    }
    if (ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1
      && ts.isStringLiteralLike(node.arguments[0])) {
      values.push(node.arguments[0].text)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return values
}

function isEntryPoint(file: string) {
  const name = relative(file)
  const basename = path.basename(file)
  return name === 'src/payload.config.ts'
    || name === 'src/app/(payload)/admin/importMap.js'
    || name.startsWith('src/scripts/')
    || name.startsWith('src/migrations/')
    || (name.startsWith('src/app/') && /^(page|layout|route|loading|error|not-found)\./.test(basename))
}

const legacyPaths = [
  'src/admin/modules/content/ContentView.tsx',
  'src/admin/views/BusinessViews.tsx',
  'src/admin/views/Dashboard.tsx',
  'src/admin/views/SiteViews.tsx',
]

const allowedFollowUpReaders = new Set([
  'src/collections/AfterSales.ts',
  'src/scripts/migrate-after-sales-followups.ts',
])

const allFiles = await walk(sourceRoot)
const codeFiles = allFiles.filter((file) => codeExtensions.has(path.extname(file)) && !isGenerated(file))
const fileSet = new Set(codeFiles)
const graph = new Map<string, Set<string>>()
const illegalFollowUpReaders: string[] = []

for (const file of codeFiles) {
  const content = await fs.readFile(file, 'utf8')
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true)
  const dependencies = new Set<string>()
  for (const specifier of importSpecifiers(source)) {
    const resolved = resolveImport(file, specifier, fileSet)
    if (resolved) dependencies.add(resolved)
  }
  graph.set(file, dependencies)

  const name = relative(file)
  if (/\bfollowUps\b/.test(content) && !allowedFollowUpReaders.has(name)) {
    illegalFollowUpReaders.push(name)
  }
}

const reachable = new Set<string>()
const queue = codeFiles.filter(isEntryPoint)
while (queue.length) {
  const file = queue.pop()
  if (!file || reachable.has(file)) continue
  reachable.add(file)
  for (const dependency of graph.get(file) || []) queue.push(dependency)
}

const orphanFiles = codeFiles
  .filter((file) => !reachable.has(file))
  .map(relative)
  .sort()
const presentLegacyPaths = legacyPaths.filter((name) => fileSet.has(path.join(root, name)))

const report = {
  generatedAt: new Date().toISOString(),
  sourceFiles: codeFiles.length,
  entryPoints: codeFiles.filter(isEntryPoint).map(relative).sort(),
  reachableFiles: reachable.size,
  orphanFiles,
  presentLegacyPaths,
  illegalFollowUpReaders: illegalFollowUpReaders.sort(),
}

await fs.mkdir(artifactsRoot, { recursive: true })
await fs.writeFile(
  path.join(artifactsRoot, 'dead-code-analysis.json'),
  `${JSON.stringify(report, null, 2)}\n`,
)
console.log(JSON.stringify(report, null, 2))

if (orphanFiles.length || presentLegacyPaths.length || illegalFollowUpReaders.length) {
  console.error('A análise de código morto encontrou resíduos que precisam ser removidos ou explicitamente conectados a um entry point.')
  process.exit(1)
}
