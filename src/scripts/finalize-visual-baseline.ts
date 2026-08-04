import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import {
  expectedTotalPngs,
  type VisualBaselineManifest,
} from '../visual-baseline/contract'

const root = process.cwd()
const outputDir = path.resolve(process.env.VISUAL_CURRENT_DIR || path.join(root, 'artifacts', 'admin-baseline'))
const manifestPath = path.join(outputDir, 'baseline-manifest.json')
const fixtureMapPath = path.join(outputDir, 'fixture-map.json')

async function exists(target: string) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

async function pngFiles(current = outputDir): Promise<string[]> {
  if (!(await exists(current))) return []
  const entries = await fs.readdir(current, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(current, entry.name)
    if (entry.isDirectory()) return pngFiles(absolute)
    if (entry.isFile() && entry.name.toLocaleLowerCase('en-US').endsWith('.png')) {
      return [path.relative(outputDir, absolute).split(path.sep).join('/')]
    }
    return []
  }))
  return nested.flat().sort()
}

async function fileRecord(relative: string) {
  const absolute = path.join(outputDir, relative)
  const buffer = await fs.readFile(absolute)
  return {
    path: relative,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    bytes: buffer.byteLength,
  }
}

async function playwrightVersion() {
  try {
    const packageJSON = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')) as {
      devDependencies?: Record<string, string>
    }
    return packageJSON.devDependencies?.['@playwright/test']
  } catch {
    return undefined
  }
}

async function main() {
  if (!(await exists(manifestPath))) throw new Error(`Manifesto visual ausente: ${manifestPath}`)
  if (!(await exists(fixtureMapPath))) throw new Error(`Mapa de fixtures ausente: ${fixtureMapPath}`)

  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as VisualBaselineManifest
  if (manifest.schemaVersion !== 2) throw new Error(`Schema visual incompatível: ${String(manifest.schemaVersion)}`)
  if (manifest.expectedPngs !== expectedTotalPngs) {
    throw new Error(`Contrato visual divergente: manifesto espera ${manifest.expectedPngs}, código espera ${expectedTotalPngs}.`)
  }

  const files = await pngFiles()
  if (files.length !== expectedTotalPngs) {
    throw new Error(`Captura visual incompleta: ${files.length}/${expectedTotalPngs} PNGs encontrados.`)
  }

  const records = await Promise.all(files.map(fileRecord))
  const finalized: VisualBaselineManifest = {
    ...manifest,
    source: 'finalize-visual-baseline',
    complete: true,
    actualPngs: files.length,
    capturedAt: new Date().toISOString(),
    playwrightVersion: await playwrightVersion(),
    files: records,
  }

  await fs.writeFile(manifestPath, `${JSON.stringify(finalized, null, 2)}\n`, 'utf8')
  console.log(`Baseline visual finalizada: ${files.length}/${expectedTotalPngs} PNGs, manifesto completo e hashes registrados.`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
