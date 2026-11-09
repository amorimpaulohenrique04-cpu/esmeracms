import { describe, expect, it } from 'vitest'

import { openXlsxWorkbook, parseXlsxWorkbook } from '../../src/admin/modules/products/xlsx'
import { createProductImportXlsxTemplate } from '../../src/server/domain/products/xlsxTemplate'

describe('product import xlsx', () => {
  it('gera um modelo .xlsx que o importador consegue ler sem conversão para CSV', async () => {
    const file = createProductImportXlsxTemplate()
    const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer
    const workbook = await parseXlsxWorkbook(buffer)

    expect(workbook.sheets).toHaveLength(1)
    expect(workbook.sheets[0]?.name).toBe('Produtos')
    expect(workbook.sheets[0]?.text).toContain('nome\tcodigo\tcategoria\tpreco\tmodo_preco')
    expect(workbook.sheets[0]?.text).toContain('Vaso Terracota\tOBJ-101\tCerâmica\t890,00')
  })
})

function workbookZip(files: Record<string, string>) {
  const entries: Buffer[] = []
  const directory: Buffer[] = []
  let offset = 0
  for (const [name, content] of Object.entries(files)) {
    const path = Buffer.from(name)
    const data = Buffer.from(content)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(path.length, 26)
    entries.push(local, path, data)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(path.length, 28)
    central.writeUInt32LE(offset, 42)
    directory.push(central, path)
    offset += local.length + path.length + data.length
  }
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(Object.keys(files).length, 10)
  end.writeUInt32LE(offset, 16)
  return Uint8Array.from(Buffer.concat([...entries, ...directory, end])).buffer
}

it('lê apenas a aba selecionada e preserva linhas do Excel após célula multilinha', async () => {
  const buffer = workbookZip({
    'xl/workbook.xml': '<sheets><sheet name="Produtos" r:id="r1"/><sheet name="Rascunho" r:id="r2"/></sheets>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="r1" Type="/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="r2" Type="/worksheet" Target="worksheets/missing.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': '<sheetData>' +
      '<row r="1"><c r="A1" t="inlineStr"><is><t>nome</t></is></c><c r="B1" t="inlineStr"><is><t>codigo</t></is></c></row>' +
      '<row r="3"><c r="A3" t="inlineStr"><is><t>Vaso&#10;de cerâmica</t></is></c><c r="B3"><v>1</v></c></row>' +
      '<row r="4"><c r="A4" t="inlineStr"><is><t>Bandeja</t></is></c><c r="B4"><v>2</v></c></row>' +
      '</sheetData>',
  })
  const workbook = await openXlsxWorkbook(buffer)
  expect(workbook.sheetNames).toEqual(['Produtos', 'Rascunho'])
  const products = await workbook.readSheet(0)
  expect(products.text).toContain('"Vaso\nde cerâmica"\t1')
  expect(products.sourceLines).toEqual([3, 4])
  await expect(workbook.readSheet(1)).rejects.toThrow('worksheets/missing.xml')
})
