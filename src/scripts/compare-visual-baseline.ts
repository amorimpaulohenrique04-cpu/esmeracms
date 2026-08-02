import fs from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

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
}

type VisualApproval = {
  baseSha?: string
  reason?: string
  files?: string[]
}

type VisualReport = {
  generatedAt: string
  baseSha: string | null
  referenceDir: string
  currentDir: string
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

async function loadApproval() {
  if (!(await exists(approvalPath))) return { active: false, reason: null, files: new Set<string>() }
  const parsed = JSON.parse(await fs.readFile(approvalPath, 'utf8')) as VisualApproval
  const active = Boolean(baseSha && parsed.baseSha && baseSha === parsed.baseSha)
  return {
    active,
    reason: active ? parsed.reason || null : null,
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

async function compareImage(relative: string, approvedFiles: Set<string>): Promise<ImageMetrics> {
  const referencePath = path.join(referenceDir, relative)
  const currentPath = path.join(currentDir, relative)
  const referenceExists = await exists(referencePath)
  const currentExists = await exists(currentPath)
  const approved = approvedFiles.has(relative)

  if (!referenceExists) {
    const current = await readRaw(currentPath)
    return {
      file: relative,
      width: current.width,
      height: current.height,
      mismatchRatio: 0,
      meanChannelDelta: 0,
      changedPixels: 0,
      totalPixels: current.width * current.height,
      status: 'new',
    }
  }

  if (!currentExists) {
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

  return {
    file: relative,
    width: current.width,
    height: current.height,
    mismatchRatio: Number(mismatchRatio.toFixed(6)),
    meanChannelDelta: Number(meanChannelDelta.toFixed(3)),
    changedPixels,
    totalPixels,
    status: changedBeyondBudget ? (approved ? 'approved-change' : 'failed') : 'passed',
  }
}

async function main() {
  const approval = await loadApproval()
  const [referenceFiles, currentFiles] = await Promise.all([pngFiles(referenceDir), pngFiles(currentDir)])
  if (!currentFiles.length) throw new Error(`Nenhuma captura PNG foi encontrada em ${currentDir}.`)
  if (!referenceFiles.length) {
    console.log(`Nenhum baseline de referência encontrado em ${referenceDir}; ${currentFiles.length} capturas serão registradas como novas.`)
  }

  const allFiles = [...new Set([...referenceFiles, ...currentFiles])].sort()
  const images: ImageMetrics[] = []
  for (const file of allFiles) images.push(await compareImage(file, approval.files))

  const report: VisualReport = {
    generatedAt: new Date().toISOString(),
    baseSha,
    referenceDir,
    currentDir,
    approval: {
      active: approval.active,
      reason: approval.reason,
      files: [...approval.files],
    },
    thresholds: { channelDelta, maxMismatchRatio, maxMeanChannelDelta },
    summary: {
      compared: images.filter((image) => ['passed', 'failed', 'approved-change'].includes(image.status)).length,
      passed: images.filter((image) => image.status === 'passed').length,
      approvedChanges: images.filter((image) => image.status === 'approved-change').length,
      failed: images.filter((image) => ['failed', 'missing', 'dimension-mismatch'].includes(image.status)).length,
      newFiles: images.filter((image) => image.status === 'new').length,
      missingFiles: images.filter((image) => image.status === 'missing').length,
    },
    images,
  }

  await fs.mkdir(path.dirname(reportPath), { recursive: true })
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  console.log(`Visual regression: ${report.summary.passed}/${report.summary.compared} comparações aprovadas; ${report.summary.approvedChanges} mudanças explicitamente aprovadas; ${report.summary.newFiles} novas; ${report.summary.failed} falhas.`)
  for (const image of images.filter((item) => item.status !== 'passed')) {
    console.log(`- ${image.status}: ${image.file} · mismatch ${(image.mismatchRatio * 100).toFixed(2)}% · delta ${image.meanChannelDelta}`)
  }

  if (report.summary.failed > 0) process.exitCode = 1
}

await main()
