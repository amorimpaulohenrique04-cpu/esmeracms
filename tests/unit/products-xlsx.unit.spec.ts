import { describe, expect, it } from 'vitest'

import { parseXlsxWorkbook } from '../../src/admin/modules/products/xlsx'
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
