import fs from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

import type { VisualBaselineManifest } from '../visual-baseline/contract'

type ImageStatus = 'passed' | 'failed' | 'approved-change' | 'new' | 'missing' | 'dimension-mismatch'

type ImageMetrics = {
  file: string
  width: number
  height: number
  mismatchRatio: number
  meanChannelDelta: number
  changedPixels: number
  totalPixels: number
  status: ImageStatus
  diffFile?: string
}

type VisualApproval = {
  baseSha?: string
  datasetVersion?: string
  reason?: string
  bootstrapReference?: boolean
  files?: string[]
}

type LoadedApproval = {
  active: boolean
  reason: string | null
  bootstrapReference: boolean
  files: Set<string>
}

type VisualReport = {
  generatedAt: string
  baseSha: string | null
  referenceDir: string
  currentDir: string
  bootstrapReference: boolean
  approval: {
    active: boolean
    reason: string | null
    files: string[]
  }
  thresholds: {
    channelDelta: number
    maxMismatchRatio: number
    maxMeanChannelDelta: number
  }
  manifests: {
    current: VisualBaselineManifest
    reference: VisualBaselineManifest | null
  }
  summary: {
    compared: number
    passed: number
    approvedChanges: number
    failed: number
    newFiles: number
    missingFiles: number
  }
  images: ImageMetrics[]
}

const referenceDir = path.resolve(process.env.VISUAL_REFERENCE_DIR || 'artifacts/reference-baseline')
const currentDir = path.resolve(process.env.VISUAL_CURRENT_DIR || 'artifacts/admin-baseline')
const reportPath = path.resolve(process.env.VISUAL_REPORT_PATH || 'artifacts/visual-regression-report.json')
const htmlReportPath = path.resolve(process.env.VISUAL_REPORT_HTML_PATH || 'artifacts/visual-regression-report.html')
const diffDir = path.resolve(process.env.VISUAL_DIFF_DIR || 'artifacts/visual-diffs')
const approvalPath = path.resolve(process.env.VISUAL_APPROVAL_FILE || 'visual-regression.approvals.json')
const baseSha = process.env.VISUAL_BASE_SHA?.trim() || null
const channelDelta = Number(process.env.VISUAL_CHANNEL_DELTA || 24)
const maxMismatchRatio = Number(process.env.VISUAL_MAX_MISMATCH_RATIO || 0.025)
const maxMeanChannelDelta = Number(process.env.VISUAL_MAX_MEAN_DELTA || 5)

async function exists(target: string) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

async function loadManifest(root: string, label: string): Promise<VisualBaselineManifest> {
  const file = path.join(root, 'baseline-manifest.json')
  if (!(await exists(file))) throw new Error(`${label}: baseline-manifest.json ausente em ${root}.`)
  const manifest = JSON.parse(await fs.readFile(file, 'utf8')) as VisualBaselineManifest
  if (manifest.schemaVersion !== 2) throw new Error(`${label}: schema visual ${String(manifest.schemaVersion)} incompatível; esperado 2.`)
  if (!manifest.complete) throw new Error(`${label}: manifesto existe, mas a captura não está marcada como completa.`)
  if (manifest.actualPngs !== manifest.expectedPngs) {
    throw new Error(`${label}: captura incompleta (${manifest.actualPngs}/${manifest.expectedPngs}).`)
  }
  if (manifest.files.length !== manifest.actualPngs) {
    throw new Error(`${label}: manifesto possui ${manifest.files.length} hashes para ${manifest.actualPngs} PNGs.`)
  }
  return manifest
}

function stableJSON(value: unknown) {
  return JSON.stringify(value)
}

function assertCompatible(reference: VisualBaselineManifest, current: VisualBaselineManifest) {
  const fields: Array<[string, unknown, unknown]> = [
    ['datasetVersion', reference.datasetVersion, current.datasetVersion],
    ['expectedPngs', reference.expectedPngs, current.expectedPngs],
    ['fixedTime', reference.fixedTime, current.fixedTime],
    ['platform', reference.platform, current.platform],
    ['playwrightVersion', reference.playwrightVersion, current.playwrightVersion],
    ['viewports', stableJSON(reference.viewports), stableJSON(current.viewports)],
    ['scenarios', stableJSON(reference.scenarios), stableJSON(current.scenarios)],
  ]

  const mismatches = fields
    .filter(([, left, right]) => left !== right)
    .map(([field, left, right]) => `${field}: referência=${String(left)} atual=${String(right)}`)

  if (mismatches.length) {
    throw new Error(`Baselines incompatíveis:\n- ${mismatches.join('\n- ')}`)
  }
}

async function loadApproval(currentManifest: VisualBaselineManifest): Promise<LoadedApproval> {
  if (!(await exists(approvalPath))) {
    return { active: false, reason: null, bootstrapReference: false, files: new Set<string>() }
  }

  const parsed = JSON.parse(await fs.readFile(approvalPath, 'utf8')) as VisualApproval
  const active = Boolean(
    baseSha
    && parsed.baseSha
    && baseSha === parsed.baseSha
    && parsed.datasetVersion === currentManifest.datasetVersion,
  )

  return {
    active,
    reason: active ? parsed.reason || null : null,
    bootstrapReference: active && parsed.bootstrapReference === true,
    files: new Set(active ? parsed.files || [] : []),
  }
}

async function pngFiles(root: string, current = root): Promise<string[]> {
  if (!(await exists(current))) return []
  const entries = await fs.readdir(current, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(current, entry.name)
    if (entry.isDirectory()) return pngFiles(root, absolute)
    if (entry.isFile() && entry.name.toLocaleLowerCase('en-US').endsWith('.png')) {
      return [path.relative(root, absolute).split(path.sep).join('/')]
    }
    return []
  }))
  return nested.flat().sort()
}

async function readRaw(file: string) {
  const image = sharp(file).ensureAlpha()
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height, channels: info.channels }
}

async function createDiff(relative: string, reference: Awaited<ReturnType<typeof readRaw>>, current: Awaited<ReturnType<typeof readRaw>>) {
  const buffer = Buffer.alloc(current.data.length)
  const totalPixels = current.width * current.height

  for (let pixel = 0; pixel < totalPixels; pixel += 1) {
    const offset = pixel * current.channels
    let changed = false
    for (let channel = 0; channel < 3; channel += 1) {
      if (Math.abs(current.data[offset + channel] - reference.data[offset + channel]) > channelDelta) changed = true
    }

    if (changed) {
      buffer[offset] = 220
      buffer[offset + 1] = 38
      buffer[offset + 2] = 38
      buffer[offset + 3] = 255
    } else {
      const gray = Math.round((current.data[offset] + current.data[offset + 1] + current.data[offset + 2]) / 3)
      buffer[offset] = gray
      buffer[offset + 1] = gray
      buffer[offset + 2] = gray
      buffer[offset + 3] = 90
    }
  }

  const diffRelative = relative.replace(/\.png$/i, '.diff.png')
  const absolute = path.join(diffDir, diffRelative)
  await fs.mkdir(path.dirname(absolute), { recursive: true })
  await sharp(buffer, { raw: { width: current.width, height: current.height, channels: 4 } }).png().toFile(absolute)
  return path.relative(path.dirname(reportPath), absolute).split(path.sep).join('/')
}

async function compareImage(relative: string, approvedFiles: Set<string>): Promise<ImageMetrics> {
  const referencePath = path.join(referenceDir, relative)
  const currentPath = path.join(currentDir, relative)
  const referenceExists = await exists(referencePath)
  const currentExists = await exists(currentPath)
  const approved = approvedFiles.has(relative)

  if (!referenceExists && currentExists) {
    const current = await readRaw(currentPath)
    return {
      file: relative,
      width: current.width,
      height: current.height,
      mismatchRatio: 1,
      meanChannelDelta: 255,
      changedPixels: current.width * current.height,
      totalPixels: current.width * current.height,
      status: approved ? 'approved-change' : 'new',
    }
  }

  if (referenceExists && !currentExists) {
    const reference = await readRaw(referencePath)
    return {
      file: relative,
      width: reference.width,
      height: reference.height,
      mismatchRatio: 1,
      meanChannelDelta: 255,
      changedPixels: reference.width * reference.height,
      totalPixels: reference.width * reference.height,
      status: approved ? 'approved-change' : 'missing',
    }
  }

  if (!referenceExists || !currentExists) throw new Error(`Estado visual inválido para ${relative}.`)

  const [reference, current] = await Promise.all([readRaw(referencePath), readRaw(currentPath)])
  if (reference.width !== current.width || reference.height !== current.height || reference.channels !== current.channels) {
    return {
      file: relative,
      width: current.width,
      height: current.height,
      mismatchRatio: 1,
      meanChannelDelta: 255,
      changedPixels: current.width * current.height,
      totalPixels: current.width * current.height,
      status: approved ? 'approved-change' : 'dimension-mismatch',
    }
  }

  let changedPixels = 0
  let deltaSum = 0
  const totalPixels = current.width * current.height

  for (let pixel = 0; pixel < totalPixels; pixel += 1) {
    const offset = pixel * current.channels
    let pixelChanged = false
    for (let channel = 0; channel < 3; channel += 1) {
      const delta = Math.abs(current.data[offset + channel] - reference.data[offset + channel])
      deltaSum += delta
      if (delta > channelDelta) pixelChanged = true
    }
    if (pixelChanged) changedPixels += 1
  }

  const mismatchRatio = totalPixels ? changedPixels / totalPixels : 0
  const meanChannelDelta = totalPixels ? deltaSum / (totalPixels * 3) : 0
  const changedBeyondBudget = mismatchRatio > maxMismatchRatio || meanChannelDelta > maxMeanChannelDelta
  const status: ImageStatus = changedBeyondBudget ? (approved ? 'approved-change' : 'failed') : 'passed'
  const diffFile = changedBeyondBudget ? await createDiff(relative, reference, current) : undefined

  return {
    file: relative,
    width: current.width,
    height: current.height,
    mismatchRatio: Number(mismatchRatio.toFixed(6)),
    meanChannelDelta: Number(meanChannelDelta.toFixed(3)),
    changedPixels,
    totalPixels,
    status,
    diffFile,
  }
}

function escapeHTML(value: unknown) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

async function writeReports(report: VisualReport) {
  await fs.mkdir(path.dirname(reportPath), { recursive: true })
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  const rows = report.images.map((image) => `
    <tr class="${escapeHTML(image.status)}">
      <td>${escapeHTML(image.file)}</td>
      <td>${escapeHTML(image.status)}</td>
      <td>${(image.mismatchRatio * 100).toFixed(2)}%</td>
      <td>${image.meanChannelDelta.toFixed(3)}</td>
      <td>${image.diffFile ? `<a href="${escapeHTML(image.diffFile)}">diff</a>` : '—'}</td>
    </tr>`).join('')

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Esméra CMS · Visual regression</title>
  <style>
    body{font:14px/1.45 Inter,system-ui,sans-serif;margin:32px;color:#17211d;background:#f5f7f6}
    main{max-width:1180px;margin:auto;background:#fff;padding:28px;border:1px solid #ccd5d1}
    h1{margin:0 0 8px} .summary{display:flex;gap:16px;flex-wrap:wrap;margin:20px 0}
    .summary span{padding:10px 14px;background:#edf2ef;border:1px solid #d7dfdb}
    table{border-collapse:collapse;width:100%} th,td{padding:9px;border-bottom:1px solid #dce2df;text-align:left}
    th{background:#173f37;color:#fff}.failed,.missing,.dimension-mismatch,.new{background:#fff0f0}.approved-change{background:#fff8e8}
    code{font-family:ui-monospace,SFMono-Regular,monospace}
  </style>
</head>
<body><main>
  <h1>Regressão visual · Esméra CMS</h1>
  <p>Base SHA: <code>${escapeHTML(report.baseSha || 'não informado')}</code></p>
  <div class="summary">
    <span>Passaram: <strong>${report.summary.passed}</strong></span>
    <span>Aprovadas: <strong>${report.summary.approvedChanges}</strong></span>
    <span>Falharam: <strong>${report.summary.failed}</strong></span>
    <span>Novas: <strong>${report.summary.newFiles}</strong></span>
    <span>Ausentes: <strong>${report.summary.missingFiles}</strong></span>
  </div>
  <table><thead><tr><th>Arquivo</th><th>Status</th><th>Mismatch</th><th>Delta médio</th><th>Diagnóstico</th></tr></thead><tbody>${rows}</tbody></table>
</main></body></html>`

  await fs.writeFile(htmlReportPath, html, 'utf8')
}

function summary(images: ImageMetrics[]) {
  return {
    compared: images.length,
    passed: images.filter((image) => image.status === 'passed').length,
    approvedChanges: images.filter((image) => image.status === 'approved-change').length,
    failed: images.filter((image) => ['failed', 'new', 'missing', 'dimension-mismatch'].includes(image.status)).length,
    newFiles: images.filter((image) => image.status === 'new').length,
    missingFiles: images.filter((image) => image.status === 'missing').length,
  }
}

async function main() {
  await fs.rm(diffDir, { recursive: true, force: true })

  const currentManifest = await loadManifest(currentDir, 'Captura atual')
  const approval = await loadApproval(currentManifest)
  const currentFiles = await pngFiles(currentDir)
  if (!currentFiles.length) throw new Error(`Nenhuma captura PNG foi encontrada em ${currentDir}.`)
  if (currentFiles.length !== currentManifest.actualPngs) {
    throw new Error(`Captura atual diverge do manifesto: ${currentFiles.length}/${currentManifest.actualPngs} PNGs.`)
  }

  const referenceFiles = await pngFiles(referenceDir)
  let referenceManifest: VisualBaselineManifest | null = null
  let bootstrapReference = false
  let images: ImageMetrics[]

  if (!referenceFiles.length) {
    if (!approval.bootstrapReference) {
      throw new Error('Nenhuma baseline de referência compatível foi encontrada e não existe aprovação explícita de bootstrap para este base SHA.')
    }

    bootstrapReference = true
    images = await Promise.all(currentFiles.map(async (file) => {
      const current = await readRaw(path.join(currentDir, file))
      return {
        file,
        width: current.width,
        height: current.height,
        mismatchRatio: 1,
        meanChannelDelta: 255,
        changedPixels: current.width * current.height,
        totalPixels: current.width * current.height,
        status: 'approved-change' as const,
      }
    }))
  } else {
    referenceManifest = await loadManifest(referenceDir, 'Baseline de referência')
    assertCompatible(referenceManifest, currentManifest)
    if (referenceFiles.length !== referenceManifest.actualPngs) {
      throw new Error(`Referência diverge do manifesto: ${referenceFiles.length}/${referenceManifest.actualPngs} PNGs.`)
    }

    const allFiles = [...new Set([...referenceFiles, ...currentFiles])].sort()
    images = []
    for (const file of allFiles) images.push(await compareImage(file, approval.files))
  }

  const report: VisualReport = {
    generatedAt: new Date().toISOString(),
    baseSha,
    referenceDir,
    currentDir,
    bootstrapReference,
    approval: {
      active: approval.active,
      reason: approval.reason,
      files: [...approval.files],
    },
    thresholds: { channelDelta, maxMismatchRatio, maxMeanChannelDelta },
    manifests: { current: currentManifest, reference: referenceManifest },
    summary: summary(images),
    images,
  }

  await writeReports(report)

  console.log(`Visual regression: ${report.summary.passed}/${report.summary.compared} sem alteração; ${report.summary.approvedChanges} mudanças aprovadas; ${report.summary.failed} falhas.`)
  if (bootstrapReference) console.log(`Bootstrap visual aprovado: ${approval.reason || 'sem motivo informado'}`)
  for (const image of images.filter((item) => item.status !== 'passed')) {
    console.log(`- ${image.status}: ${image.file} · mismatch ${(image.mismatchRatio * 100).toFixed(2)}% · delta ${image.meanChannelDelta}`)
  }

  if (report.summary.failed > 0) process.exitCode = 1
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
