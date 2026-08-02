import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const buildRoot = path.join(root, '.next')
const artifactsRoot = path.join(root, 'artifacts')
const targets = [
  path.join(buildRoot, 'static', 'chunks'),
  path.join(buildRoot, 'server', 'app'),
]

async function walk(directory: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true })
    const nested = await Promise.all(entries.map(async (entry) => {
      const absolute = path.join(directory, entry.name)
      return entry.isDirectory() ? walk(absolute) : [absolute]
    }))
    return nested.flat()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

const files = (await Promise.all(targets.map(walk))).flat()
const assets = await Promise.all(files.map(async (file) => {
  const stat = await fs.stat(file)
  return {
    file: path.relative(root, file).split(path.sep).join('/'),
    bytes: stat.size,
  }
}))

assets.sort((a, b) => b.bytes - a.bytes)
const javascript = assets.filter((asset) => /\.(?:js|mjs)$/.test(asset.file))
const report = {
  generatedAt: new Date().toISOString(),
  files: assets.length,
  totalBytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
  javascriptBytes: javascript.reduce((sum, asset) => sum + asset.bytes, 0),
  largestAssets: assets.slice(0, 25),
  largestJavaScriptAssets: javascript.slice(0, 25),
}

if (!assets.length) {
  console.error('Nenhum artefato de build foi encontrado em .next. Execute pnpm build antes da análise de bundle.')
  process.exit(1)
}

await fs.mkdir(artifactsRoot, { recursive: true })
await fs.writeFile(
  path.join(artifactsRoot, 'bundle-analysis.json'),
  `${JSON.stringify(report, null, 2)}\n`,
)
console.log(JSON.stringify(report, null, 2))
