import type { ReportingSnapshot } from '..'

export type ReportExportIdentity = {
  id: string
  name: string
  email: string | null
}

export type ReportFilterLabels = {
  comparison: string
  owner: string
  source: string
  category: string
  product: string
}

type PDFExportInput = {
  snapshot: ReportingSnapshot
  identity: ReportExportIdentity
  filterLabels: ReportFilterLabels
  exportedAt: string
}

type FontName = 'regular' | 'bold'
type PageState = { commands: string[]; cursor: number }

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 44
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const TEXT = '#25302c'
const MUTED = '#68716d'
const LINE = '#d9dfdc'
const SOFT = '#f4f6f5'
const ACCENT = '#355e52'

const winAnsiOverrides: Record<number, number> = {
  0x0152: 0x8c,
  0x0153: 0x9c,
  0x0160: 0x8a,
  0x0161: 0x9a,
  0x0178: 0x9f,
  0x017d: 0x8e,
  0x017e: 0x9e,
  0x0192: 0x83,
  0x02c6: 0x88,
  0x02dc: 0x98,
  0x2013: 0x96,
  0x2014: 0x97,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201a: 0x82,
  0x201c: 0x93,
  0x201d: 0x94,
  0x201e: 0x84,
  0x2022: 0x95,
  0x2026: 0x85,
  0x20ac: 0x80,
  0x2122: 0x99,
}

function byteForCharacter(character: string) {
  const code = character.codePointAt(0) || 32
  if (code <= 0x7f || (code >= 0xa0 && code <= 0xff)) return code
  return winAnsiOverrides[code] ?? 0x3f
}

function hexText(value: string) {
  return [...value.replace(/[\r\n\t]+/g, ' ')].map((character) => byteForCharacter(character).toString(16).padStart(2, '0')).join('').toUpperCase()
}

function pdfText(value: string) {
  return `<${hexText(value)}>`
}

function pdfString(value: string) {
  return `(${value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[\r\n]+/g, ' ')})`
}

function rgb(hex: string) {
  const normalized = hex.replace('#', '')
  const values = [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16) / 255)
  return values.map((value) => value.toFixed(3)).join(' ')
}

function money(cents: number | null | undefined) {
  if (typeof cents !== 'number') return 'Sem base'
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function percent(value: number | null | undefined) {
  if (typeof value !== 'number') return 'Sem base'
  return value.toLocaleString('pt-BR', { style: 'percent', maximumFractionDigits: 1 })
}

function days(value: number | null | undefined) {
  if (typeof value !== 'number') return 'Sem base'
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`
}

function date(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Data inválida'
  return parsed.toLocaleDateString('pt-BR', { timeZone: 'America/Recife' })
}

function dateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Data inválida'
  return parsed.toLocaleString('pt-BR', {
    timeZone: 'America/Recife',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function approximateWidth(value: string, size: number) {
  return [...value].reduce((total, character) => total + (/[MW@%]/.test(character) ? 0.75 : /[ilI1.,:;]/.test(character) ? 0.28 : 0.52), 0) * size
}

function wrap(value: string, maxWidth: number, size: number) {
  const words = value.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ['']
  const lines: string[] = []
  let current = words[0]
  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`
    if (approximateWidth(candidate, size) <= maxWidth) current = candidate
    else {
      lines.push(current)
      current = word
    }
  }
  lines.push(current)
  return lines
}

class PDFDocumentBuilder {
  pages: PageState[] = []
  page: PageState

  constructor(private readonly semanticVersion: string) {
    this.page = this.newPage()
  }

  private newPage() {
    const page: PageState = { commands: [], cursor: 66 }
    this.pages.push(page)
    this.page = page
    this.text('ESMÉRA', MARGIN, 39, 9, 'bold', ACCENT)
    this.text('RELATÓRIO COMERCIAL', PAGE_WIDTH - MARGIN, 39, 8, 'bold', MUTED, 'right')
    this.line(MARGIN, 49, PAGE_WIDTH - MARGIN, 49, LINE, 0.7)
    return page
  }

  private ensure(height: number) {
    if (this.page.cursor + height <= PAGE_HEIGHT - 54) return
    this.newPage()
  }

  text(value: string, x: number, top: number, size = 10, font: FontName = 'regular', color = TEXT, align: 'left' | 'right' | 'center' = 'left') {
    let drawX = x
    const width = approximateWidth(value, size)
    if (align === 'right') drawX -= width
    if (align === 'center') drawX -= width / 2
    const y = PAGE_HEIGHT - top - size
    this.page.commands.push(`BT /${font === 'bold' ? 'F2' : 'F1'} ${size.toFixed(2)} Tf ${rgb(color)} rg 1 0 0 1 ${drawX.toFixed(2)} ${y.toFixed(2)} Tm ${pdfText(value)} Tj ET`)
  }

  paragraph(value: string, x: number, top: number, width: number, size = 9, lineHeight = 13, color = MUTED, font: FontName = 'regular') {
    const lines = wrap(value, width, size)
    lines.forEach((line, index) => this.text(line, x, top + index * lineHeight, size, font, color))
    return lines.length * lineHeight
  }

  line(x1: number, y1: number, x2: number, y2: number, color = LINE, width = 0.6) {
    this.page.commands.push(`${rgb(color)} RG ${width.toFixed(2)} w ${x1.toFixed(2)} ${(PAGE_HEIGHT - y1).toFixed(2)} m ${x2.toFixed(2)} ${(PAGE_HEIGHT - y2).toFixed(2)} l S`)
  }

  rect(x: number, top: number, width: number, height: number, fill = SOFT, stroke: string | null = null) {
    const y = PAGE_HEIGHT - top - height
    const strokeCommand = stroke ? `${rgb(stroke)} RG` : ''
    const paint = stroke ? 'B' : 'f'
    this.page.commands.push(`${rgb(fill)} rg ${strokeCommand} ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re ${paint}`)
  }

  gap(value: number) {
    this.page.cursor += value
  }

  heading(eyebrow: string, title: string, copy?: string) {
    const copyHeight = copy ? wrap(copy, CONTENT_WIDTH, 9).length * 13 : 0
    this.ensure(48 + copyHeight)
    this.text(eyebrow.toUpperCase(), MARGIN, this.page.cursor, 7.5, 'bold', ACCENT)
    this.page.cursor += 15
    this.text(title, MARGIN, this.page.cursor, 16, 'bold', TEXT)
    this.page.cursor += 25
    if (copy) this.page.cursor += this.paragraph(copy, MARGIN, this.page.cursor, CONTENT_WIDTH, 9, 13, MUTED)
    this.page.cursor += 8
  }

  keyValueGrid(items: Array<{ label: string; value: string }>, columns = 2) {
    const gap = 12
    const width = (CONTENT_WIDTH - gap * (columns - 1)) / columns
    const rows = Math.ceil(items.length / columns)
    const height = rows * 54
    this.ensure(height + 8)
    items.forEach((item, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      const x = MARGIN + column * (width + gap)
      const top = this.page.cursor + row * 54
      this.rect(x, top, width, 44, SOFT)
      this.text(item.label.toUpperCase(), x + 12, top + 9, 7, 'bold', MUTED)
      const valueLines = wrap(item.value, width - 24, 9.5).slice(0, 2)
      valueLines.forEach((line, lineIndex) => this.text(line, x + 12, top + 23 + lineIndex * 12, 9.5, lineIndex === 0 ? 'bold' : 'regular', TEXT))
    })
    this.page.cursor += height
  }

  kpis(items: Array<{ label: string; value: string; note: string }>) {
    const gap = 10
    const width = (CONTENT_WIDTH - gap) / 2
    const height = 78
    this.ensure(height * 2 + gap + 12)
    items.forEach((item, index) => {
      const column = index % 2
      const row = Math.floor(index / 2)
      const x = MARGIN + column * (width + gap)
      const top = this.page.cursor + row * (height + gap)
      this.rect(x, top, width, height, '#ffffff', LINE)
      this.text(item.label.toUpperCase(), x + 14, top + 13, 7.5, 'bold', MUTED)
      this.text(item.value, x + 14, top + 32, 18, 'bold', TEXT)
      this.text(item.note, x + 14, top + 59, 8, 'regular', MUTED)
    })
    this.page.cursor += height * 2 + gap + 10
  }

  table(headers: string[], rows: string[][], widths: number[]) {
    const normalizedWidths = widths.map((width) => width * CONTENT_WIDTH)
    const drawHeader = () => {
      this.ensure(30)
      this.rect(MARGIN, this.page.cursor, CONTENT_WIDTH, 25, SOFT)
      let x = MARGIN
      headers.forEach((header, index) => {
        this.text(header.toUpperCase(), x + 7, this.page.cursor + 8, 6.8, 'bold', MUTED)
        x += normalizedWidths[index]
      })
      this.page.cursor += 25
    }

    drawHeader()
    for (const row of rows) {
      const lineSets = row.map((cell, index) => wrap(String(cell ?? '—'), Math.max(20, normalizedWidths[index] - 14), 8))
      const rowHeight = Math.max(30, Math.max(...lineSets.map((lines) => lines.length)) * 11 + 12)
      if (this.page.cursor + rowHeight > PAGE_HEIGHT - 54) {
        this.newPage()
        drawHeader()
      }
      let x = MARGIN
      lineSets.forEach((lines, index) => {
        lines.slice(0, 4).forEach((line, lineIndex) => this.text(line, x + 7, this.page.cursor + 8 + lineIndex * 11, 8, index === 0 ? 'bold' : 'regular', index === 0 ? TEXT : MUTED))
        x += normalizedWidths[index]
      })
      this.line(MARGIN, this.page.cursor + rowHeight, PAGE_WIDTH - MARGIN, this.page.cursor + rowHeight, LINE, 0.45)
      this.page.cursor += rowHeight
    }
    this.page.cursor += 10
  }

  finalize(input: PDFExportInput) {
    this.pages.forEach((page, index) => {
      this.page = page
      this.line(MARGIN, PAGE_HEIGHT - 39, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 39, LINE, 0.5)
      this.text(`Contrato ${this.semanticVersion}`, MARGIN, PAGE_HEIGHT - 29, 7, 'regular', MUTED)
      this.text(`${index + 1} / ${this.pages.length}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 29, 7, 'bold', MUTED, 'right')
    })

    const objects: string[] = []
    const pageObjectNumbers: number[] = []
    const contentObjectNumbers: number[] = []
    const firstPageObject = 5
    this.pages.forEach((_, index) => {
      pageObjectNumbers.push(firstPageObject + index * 2)
      contentObjectNumbers.push(firstPageObject + index * 2 + 1)
    })
    const infoObject = firstPageObject + this.pages.length * 2

    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
    objects[2] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(' ')}] /Count ${this.pages.length} >>`
    objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
    objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'

    this.pages.forEach((page, index) => {
      const pageObject = pageObjectNumbers[index]
      const contentObject = contentObjectNumbers[index]
      const stream = `${page.commands.join('\n')}\n`
      objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`
      objects[contentObject] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}endstream`
    })

    const title = 'Relatorio comercial Esmera'
    const author = input.identity.name || input.identity.email || 'Usuario Esmera'
    objects[infoObject] = `<< /Title ${pdfString(title)} /Author ${pdfString(author)} /Subject ${pdfString(`Contrato semantico ${input.snapshot.semanticVersion}`)} /Keywords ${pdfString('Esmera, relatorio comercial, Payload CMS')} /Creator ${pdfString('Esmera Reporting PDF Renderer')} /CreationDate ${pdfString(`D:${input.exportedAt.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`)} >>`

    let output = '%PDF-1.7\n%ESMERA\n'
    const offsets: number[] = [0]
    for (let index = 1; index < objects.length; index += 1) {
      offsets[index] = Buffer.byteLength(output, 'latin1')
      output += `${index} 0 obj\n${objects[index]}\nendobj\n`
    }
    const xrefOffset = Buffer.byteLength(output, 'latin1')
    output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`
    for (let index = 1; index < objects.length; index += 1) {
      output += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
    }
    output += `trailer\n<< /Size ${objects.length} /Root 1 0 R /Info ${infoObject} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
    return Buffer.from(output, 'latin1')
  }
}

const sourceLabels: Record<string, string> = {
  instagram: 'Instagram',
  referral: 'Indicação',
  site: 'Site',
  architect: 'Arquiteto',
  organic: 'Orgânico',
  whatsapp: 'WhatsApp',
  other: 'Outro',
  unattributed: 'Não atribuída',
}

export function renderReportingPDF(input: PDFExportInput) {
  const { snapshot, identity, filterLabels, exportedAt } = input
  const document = new PDFDocumentBuilder(snapshot.semanticVersion)
  const metrics = snapshot.metrics.current

  document.text('RELATÓRIO COMERCIAL', MARGIN, 78, 8, 'bold', ACCENT)
  document.text('Desempenho e investigação', MARGIN, 96, 25, 'bold', TEXT)
  document.paragraph('Documento gerado diretamente pelo Reporting Service. Nenhuma página deste PDF é uma captura de tela do dashboard.', MARGIN, 132, CONTENT_WIDTH, 10, 15, MUTED)
  document.page.cursor = 175

  document.keyValueGrid([
    { label: 'Período', value: `${date(snapshot.filters.period.from)} - ${date(snapshot.filters.period.to)}` },
    { label: 'Gerado em', value: dateTime(exportedAt) },
    { label: 'Usuário gerador', value: identity.email ? `${identity.name} · ${identity.email}` : identity.name },
    { label: 'Versão semântica', value: snapshot.semanticVersion },
  ])

  document.heading('Filtros aplicados', 'Recorte exato do relatório')
  document.keyValueGrid([
    { label: 'Comparação', value: filterLabels.comparison },
    { label: 'Responsável', value: filterLabels.owner },
    { label: 'Origem', value: filterLabels.source },
    { label: 'Categoria', value: filterLabels.category },
    { label: 'Produto', value: filterLabels.product },
    { label: 'Snapshot', value: dateTime(snapshot.generatedAt) },
  ])

  document.heading('Indicadores', 'Resumo comercial', 'Os quatro indicadores usam o mesmo contrato semântico do Dashboard e da tela de Relatórios.')
  document.kpis([
    { label: 'Oportunidades', value: metrics.opportunitiesCreated.toLocaleString('pt-BR'), note: 'Criadas dentro do período' },
    { label: 'Conversão', value: percent(metrics.conversionRate), note: 'Ganhas sobre encerradas' },
    { label: 'Ticket médio', value: money(metrics.averageTicketCents), note: 'Vendas válidas' },
    { label: 'Ciclo de venda', value: days(metrics.averageSalesCycleDays), note: 'Oportunidades nativas ganhas' },
  ])

  document.heading('Evolução comercial', 'Série diária', 'Leads, oportunidades, vendas e receita do período. A série anterior permanece separada quando existe comparação.')
  document.table(
    ['Data', 'Leads', 'Oportunidades', 'Vendas', 'Receita'],
    snapshot.evolution.current.map((point) => [date(point.date), String(point.leads), String(point.opportunities), String(point.sales), money(point.revenueCents)]),
    [0.19, 0.13, 0.2, 0.14, 0.34],
  )

  document.heading('Funil', 'Progressão por etapa', 'Volume alcançado, avanço para a etapa seguinte e drop-off calculados a partir de Activities estruturadas.')
  document.table(
    ['Etapa', 'Volume', 'Avanço', 'Drop-off'],
    snapshot.funnel.stages.map((stage) => [stage.label, String(stage.volume), stage.stage === 'won' ? 'Final' : percent(stage.conversionToNext), `${stage.dropOff} · ${percent(stage.dropOffRate)}`]),
    [0.36, 0.16, 0.22, 0.26],
  )

  document.heading('Origem', 'Qualidade da aquisição')
  document.table(
    ['Origem', 'Oportunidades', 'Conversão', 'Receita'],
    snapshot.sources.map((source) => [sourceLabels[source.source] || source.source, String(source.opportunitiesCreated), percent(source.conversionRate), money(source.revenueCents)]),
    [0.31, 0.22, 0.21, 0.26],
  )

  document.heading('Perdas', 'Motivos registrados')
  document.table(
    ['Motivo', 'Volume', 'Participação'],
    snapshot.losses.map((loss) => [loss.label, String(loss.volume), percent(loss.shareOfLosses)]),
    [0.57, 0.18, 0.25],
  )

  document.heading('Catálogo', 'Produtos')
  document.table(
    ['Produto', 'Oportunidades', 'Conversão', 'Vendas', 'Receita'],
    snapshot.products.map((product) => [product.title, String(product.opportunitiesCreated), percent(product.conversionRate), String(product.validSales), money(product.grossItemRevenueCents)]),
    [0.36, 0.18, 0.16, 0.12, 0.18],
  )

  document.heading('Catálogo', 'Categorias')
  document.table(
    ['Categoria', 'Oportunidades', 'Conversão', 'Vendas', 'Receita'],
    snapshot.categories.map((category) => [category.title, String(category.opportunitiesCreated), percent(category.conversionRate), String(category.validSales), money(category.grossItemRevenueCents)]),
    [0.36, 0.18, 0.16, 0.12, 0.18],
  )

  document.heading('Equipe', 'Performance por responsável')
  document.table(
    ['Responsável', 'Oportunidades', 'Conversão', 'Vendas', 'Receita'],
    snapshot.team.map((member) => [member.ownerName, String(member.opportunitiesCreated), percent(member.conversionRate), String(member.validSales), money(member.revenueCents)]),
    [0.34, 0.2, 0.16, 0.12, 0.18],
  )

  document.heading('Notas metodológicas', 'Leitura correta dos dados')
  document.keyValueGrid([
    { label: 'Receita por produto', value: snapshot.notes.productRevenue },
    { label: 'Sobreposição de categorias', value: snapshot.notes.categoryOverlap },
    { label: 'Oportunidades migradas', value: snapshot.notes.migratedOpportunities },
    { label: 'Cutover do funil', value: date(snapshot.opportunityCutoverAt) },
  ], 1)

  return document.finalize(input)
}
