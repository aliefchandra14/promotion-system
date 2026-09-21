import ExcelJS from 'exceljs'

export const parseWorkbookRows = async (buffer, { headerRow = 1 } = {}) => {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const worksheet = workbook.worksheets[0]

  if (!worksheet) {
    throw new Error('The Excel file has no worksheet')
  }

  const headerByColumn = {}
  worksheet.getRow(headerRow).eachCell((cell, colNumber) => {
    headerByColumn[colNumber] = String(cell.text || '').trim().toLowerCase()
  })

  const rows = []
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRow) return

    const values = {}
    const raw = {}
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headerByColumn[colNumber]
      if (header) {
        values[header] = String(cell.text ?? '').trim()
        raw[header] = cell.value
      }
    })

    const isEmptyRow = Object.values(values).every((value) => value === '')
    if (!isEmptyRow) {
      rows.push({ rowNumber, values, raw })
    }
  })

  return rows
}

export const pickField = (values, aliases) => {
  for (const alias of aliases) {
    if (values[alias]) return values[alias]
  }
  return ''
}

export const pickRawField = (values, raw, aliases) => {
  for (const alias of aliases) {
    if (values[alias]) return raw[alias]
  }
  return null
}
