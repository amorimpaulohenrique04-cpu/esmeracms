import type { PayloadRequest, TaskConfig } from 'payload'

import {
  generateReportingPDF,
  normalizedExportFilters,
  reportExportFilename,
  resolveReportFilterLabels,
  type ReportExportIdentity,
} from '../reporting/export'
import { getReportingSnapshot, type ReportingFilters } from '../reporting'

export const GENERATE_REPORT_EXPORT_JOB = 'generateReportExport'
export const REPORT_EXPORT_QUEUE = 'operational'

type ExportRecord = {
  id: string | number
  requestedBy?: unknown
  requestedByName?: string | null
  requestedByEmail?: string | null
  filename?: string | null
  filters?: ReportingFilters | null
}

function relationshipID(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

function storedID(value: string) {
  return /^\d+$/.test(value) ? Number(value) : value
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Falha desconhecida ao gerar o PDF.'
}

async function markFailed(req: PayloadRequest, exportID: string | number, error: unknown) {
  try {
    await req.payload.update({
      collection: 'report-exports',
      id: exportID,
      overrideAccess: true,
      req,
      data: {
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: errorMessage(error).slice(0, 4000),
      },
    } as never)
  } catch (updateError) {
    req.payload.logger.error({ err: updateError, exportID }, 'failed to persist report export error')
  }
}

export const GenerateReportExportJob = {
  slug: GENERATE_REPORT_EXPORT_JOB,
  label: 'Gerar exportação pesada de relatório',
  retries: 2,
  inputSchema: [
    { name: 'exportId', type: 'text', required: true },
  ],
  outputSchema: [
    { name: 'exportId', type: 'text', required: true },
    { name: 'fileId', type: 'text', required: true },
    { name: 'filename', type: 'text', required: true },
    { name: 'semanticVersion', type: 'text', required: true },
    { name: 'fileSizeBytes', type: 'number', required: true },
  ],
  handler: async ({ input, req }) => {
    const exportID = storedID(input.exportId)

    try {
      const record = await req.payload.findByID({
        collection: 'report-exports',
        id: exportID,
        depth: 0,
        overrideAccess: true,
        req,
      } as never) as unknown as ExportRecord

      const requestedBy = relationshipID(record.requestedBy)
      if (requestedBy === null) throw new Error('A exportação não possui usuário gerador.')

      const startedAt = new Date().toISOString()
      await req.payload.update({
        collection: 'report-exports',
        id: exportID,
        depth: 0,
        overrideAccess: true,
        req,
        data: { status: 'processing', startedAt, error: null },
      } as never)

      const filters = normalizedExportFilters(record.filters || {})
      const reportingRequest = {
        ...req,
        user: {
          id: requestedBy,
          collection: 'users',
          role: 'commercial',
          name: record.requestedByName || undefined,
          email: record.requestedByEmail || undefined,
        },
      } as unknown as PayloadRequest
      const snapshot = await getReportingSnapshot(reportingRequest, filters)
      const filterLabels = await resolveReportFilterLabels(req.payload, snapshot.filters)
      const identity: ReportExportIdentity = {
        id: String(requestedBy),
        name: record.requestedByName || record.requestedByEmail || `Usuário ${requestedBy}`,
        email: record.requestedByEmail || null,
      }
      const completedAt = new Date().toISOString()
      const filename = record.filename || reportExportFilename(snapshot.filters, completedAt)
      const pdf = generateReportingPDF({ snapshot, identity, filterLabels, exportedAt: completedAt })

      const file = await req.payload.create({
        collection: 'report-export-files',
        overrideAccess: true,
        req,
        data: {
          semanticVersion: snapshot.semanticVersion,
          generatedAt: completedAt,
        },
        file: {
          data: pdf,
          mimetype: 'application/pdf',
          name: filename,
          size: pdf.byteLength,
        },
      } as never) as unknown as { id: string | number }

      await req.payload.update({
        collection: 'report-exports',
        id: exportID,
        depth: 0,
        overrideAccess: true,
        req,
        data: {
          status: 'ready',
          completedAt,
          snapshotGeneratedAt: snapshot.generatedAt,
          semanticVersion: snapshot.semanticVersion,
          filename,
          file: file.id,
          fileSizeBytes: pdf.byteLength,
          error: null,
        },
      } as never)

      return {
        output: {
          exportId: String(exportID),
          fileId: String(file.id),
          filename,
          semanticVersion: snapshot.semanticVersion,
          fileSizeBytes: pdf.byteLength,
        },
      }
    } catch (error) {
      await markFailed(req, exportID, error)
      throw error
    }
  },
} as TaskConfig<typeof GENERATE_REPORT_EXPORT_JOB>
