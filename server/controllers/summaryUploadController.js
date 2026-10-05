import ExcelJS from 'exceljs'
import { Employee, Periode, PromotionSummary } from '../models/index.js'
import { GRADES } from '../constants/grades.js'
import { DEPARTMENTS } from '../constants/departments.js'
import { getCurrentFiscalYear } from '../constants/fiscalYear.js'
import { ensureFiscalYearPeriods, PERIOD_NAMES } from '../services/periodeService.js'
import { parseWorkbookRows, pickField } from '../utils/excelImport.js'

// Same columns as the Summary table.
const UPLOAD_COLUMNS = [
  { key: 'name', header: 'Name', aliases: ['name'] },
  { key: 'employeeId', header: 'Employee ID', aliases: ['employee id', 'employeeid', 'employee'] },
  { key: 'department', header: 'Department', aliases: ['department'] },
  { key: 'currentGrade', header: 'Current Grade', aliases: ['current grade', 'currentgrade'] },
  { key: 'promoteGrade', header: 'Promote Grade', aliases: ['promote grade', 'promotegrade', 'promote to'] },
  { key: 'fiscalYear', header: 'FY', aliases: ['fy', 'fiscal year', 'fiscalyear'] },
  { key: 'periodeName', header: 'Periode', aliases: ['periode', 'period'] },
  { key: 'type', header: 'Type', aliases: ['type'] },
  { key: 'presentation', header: 'Presentation', aliases: ['presentation'] },
  { key: 'status', header: 'Status', aliases: ['status'] },
  { key: 'remark', header: 'Remark', aliases: ['remark'] },
]
const EMPLOYEE_ID_ALIASES = UPLOAD_COLUMNS.find((column) => column.key === 'employeeId').aliases
const GRADE_TITLES = GRADES.map((grade) => grade.title)
const UPLOAD_TYPES = ['NORMAL', 'SPECIAL', 'PTC']
const UPLOAD_PRESENTATIONS = ['YES', 'NO']
const UPLOAD_STATUSES = ['OK', 'Recommended', 'Not Recommended', 'Pending 6 Month']
// The outcomes a presentation can have (see the admin's final decision).
const PRESENTATION_RESULTS = ['Recommended', 'Not Recommended', 'Pending 6 Month']
const TEMPLATE_ROWS = 500

// Case-insensitive match against the allowed values, returning the canonical spelling.
const matchValue = (value, allowed) => allowed.find((item) => item.toLowerCase() === value.toLowerCase())

export const downloadSummaryTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Summary')
    sheet.columns = UPLOAD_COLUMNS.map((column) => ({
      header: column.header,
      key: column.key,
      width: column.key === 'remark' ? 36 : 20,
    }))
    sheet.getRow(1).font = { bold: true }
    sheet.views = [{ state: 'frozen', ySplit: 1 }]

    // The allowed values live on their own sheet and feed the dropdowns.
    const lists = workbook.addWorksheet('Lists')
    const listColumns = [
      ['Grades', GRADE_TITLES],
      ['Department', DEPARTMENTS],
      ['Periode', PERIOD_NAMES],
      ['Type', UPLOAD_TYPES],
      ['Presentation', UPLOAD_PRESENTATIONS],
      ['Status', UPLOAD_STATUSES],
    ]
    listColumns.forEach(([header, values], index) => {
      const column = lists.getColumn(index + 1)
      column.values = [header, ...values]
      column.width = 26
    })
    lists.getRow(1).font = { bold: true }

    const listRange = (index, count) => {
      const letter = String.fromCharCode(65 + index)
      return `Lists!$${letter}$2:$${letter}$${count + 1}`
    }
    const dropdowns = {
      currentGrade: listRange(0, GRADE_TITLES.length),
      promoteGrade: listRange(0, GRADE_TITLES.length),
      department: listRange(1, DEPARTMENTS.length),
      periodeName: listRange(2, PERIOD_NAMES.length),
      type: listRange(3, UPLOAD_TYPES.length),
      presentation: listRange(4, UPLOAD_PRESENTATIONS.length),
      status: listRange(5, UPLOAD_STATUSES.length),
    }
    for (let row = 2; row <= TEMPLATE_ROWS + 1; row += 1) {
      UPLOAD_COLUMNS.forEach((column, index) => {
        if (!dropdowns[column.key]) return
        sheet.getRow(row).getCell(index + 1).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [dropdowns[column.key]],
          showErrorMessage: true,
          errorTitle: 'Invalid value',
          error: `Choose a ${column.header} from the list`,
        }
      })
    }

    const guide = workbook.addWorksheet('Guide')
    guide.getColumn(1).width = 110
    const guideLines = [
      'How to fill in the Summary sheet',
      'Use the dropdowns: every value must be written exactly as in the lists (sheet "Lists").',
      '- Employee ID: 6 digits and registered in the employee master. Name: exactly as in the employee master.',
      '- Department: one of the departments in the list.',
      '- FY: the fiscal year, written like 2026 or FY2026 (April 2026 - March 2027). Periode: Periode 1 or Periode 2.',
      '- Current Grade / Promote Grade: from the grade list; Promote Grade must be higher than Current Grade.',
      '- Type: NORMAL, SPECIAL or PTC. Presentation: YES or NO.',
      '- Type PTC: Presentation NO and Status Recommended.',
      '- Presentation YES: only for grades that require a project; Status Recommended, Not Recommended or Pending 6 Month.',
      '- Presentation NO (NORMAL or SPECIAL): Status OK.',
      '- Remark: optional, at most 500 characters.',
      '- A row fails when the employee is already in the summary for the same FY, or appears twice in the file.',
      '- Rows that pass are added to the summary; failed rows are reported with their row number and reason.',
    ]
    guideLines.forEach((text, index) => {
      guide.getRow(index + 1).getCell(1).value = text
    })
    guide.getRow(1).font = { bold: true }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="summary-upload-template.xlsx"')
    await workbook.xlsx.write(res)
    res.end()
  } catch (error) {
    console.error('Download summary template error:', error)
    return res.status(500).json({ message: 'Something went wrong on the server' })
  }
}

// The value must be written exactly as one of the allowed values (surrounding spaces ignored).
// A value that only differs in upper/lower case is still refused, with the correct spelling.
const requireExact = (label, value, allowed) => {
  if (!value) throw new Error(`${label} is required`)
  if (allowed.includes(value)) return value
  const sameIgnoringCase = matchValue(value, allowed)
  if (sameIgnoringCase) throw new Error(`${label} "${value}" must be written as "${sameIgnoringCase}"`)
  throw new Error(`${label} "${value}" is not valid. Use one of: ${allowed.join(', ')}`)
}

const gradeStep = (title) => GRADE_TITLES.indexOf(title)
const isProjectGrade = (title) => Boolean(GRADES.find((grade) => grade.title === title)?.project)

/**
 * Checks one Excel row against the same rules the system follows, and returns the summary values.
 * Throws with the reason when the row fails.
 *  - every value written exactly as in the template lists; Employee ID in the employee master and
 *    Name exactly as in the master; Department from the department list
 *  - Promote Grade higher than Current Grade
 *  - PTC: no presentation and Recommended (as a manual PTC entry)
 *  - Presentation YES: only for a grade that requires a project; the result of a presentation is
 *    Recommended, Not Recommended or Pending 6 Month
 *  - Presentation NO (NORMAL / SPECIAL): finished without presentation, status OK
 */
const parseRow = (values, { currentFiscalYear, employeesById }) => {
  const field = Object.fromEntries(UPLOAD_COLUMNS.map((column) => [column.key, pickField(values, column.aliases)]))

  if (!/^[0-9]{6}$/.test(field.employeeId)) throw new Error('Employee ID must be a 6-digit number')
  const employee = employeesById.get(field.employeeId)
  if (!employee) throw new Error(`Employee ID ${field.employeeId} is not in the employee master data`)

  if (!field.name) throw new Error('Name is required')
  if (field.name !== employee.name) {
    throw new Error(`Name "${field.name}" does not match the employee master data ("${employee.name}")`)
  }

  const department = requireExact('Department', field.department, DEPARTMENTS)

  if (!/^(FY)?\d{4}$/.test(field.fiscalYear)) {
    throw new Error(`FY "${field.fiscalYear}" must be written like 2026 or FY2026`)
  }
  const fiscalYear = parseInt(field.fiscalYear.replace(/^FY/, ''), 10)
  if (fiscalYear < 2000 || fiscalYear > currentFiscalYear + 1) {
    throw new Error(`FY${fiscalYear} is outside the allowed range (FY2000 - FY${currentFiscalYear + 1})`)
  }

  const periodeName = requireExact('Periode', field.periodeName, PERIOD_NAMES)
  const currentGrade = requireExact('Current Grade', field.currentGrade, GRADE_TITLES)
  const promoteGrade = requireExact('Promote Grade', field.promoteGrade, GRADE_TITLES)
  if (gradeStep(promoteGrade) <= gradeStep(currentGrade)) {
    throw new Error(`Promote Grade "${promoteGrade}" must be higher than Current Grade "${currentGrade}"`)
  }

  const type = requireExact('Type', field.type, UPLOAD_TYPES)
  const presentation = requireExact('Presentation', field.presentation, UPLOAD_PRESENTATIONS)
  const status = requireExact('Status', field.status, UPLOAD_STATUSES)

  if (type === 'PTC') {
    if (presentation !== 'NO' || status !== 'Recommended') {
      throw new Error('Type PTC must have Presentation NO and Status Recommended')
    }
  } else if (presentation === 'YES') {
    if (!isProjectGrade(promoteGrade)) {
      throw new Error(`Presentation YES is only for grades that require a project; "${promoteGrade}" does not`)
    }
    if (!PRESENTATION_RESULTS.includes(status)) {
      throw new Error(`With Presentation YES the Status must be ${PRESENTATION_RESULTS.join(', ')}`)
    }
  } else if (status !== 'OK') {
    throw new Error('With Presentation NO (type NORMAL or SPECIAL) the Status must be OK')
  }

  if (field.remark.length > 500) throw new Error('Remark can be at most 500 characters')

  return {
    employeeId: field.employeeId,
    name: field.name,
    department,
    currentGrade,
    promoteGrade,
    fiscalYear,
    periodeName,
    type,
    presentation,
    status,
    remark: field.remark,
  }
}

// Adds every valid row to the summary. A row fails (reported with its Excel row number) when it is
// invalid, when the employee is already in the summary for that FY, or appears twice in the file.
export const uploadSummary = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an Excel file' })
    }

    const rows = await parseWorkbookRows(req.file.buffer)
    if (rows.length === 0) {
      return res.status(400).json({ message: 'The Excel file has no data' })
    }

    const currentFiscalYear = getCurrentFiscalYear()
    const employees = await Employee.findAll({
      where: { employeeId: [...new Set(rows.map(({ values }) => pickField(values, EMPLOYEE_ID_ALIASES)))] },
      attributes: ['employeeId', 'name'],
      raw: true,
    })
    const employeesById = new Map(employees.map((employee) => [employee.employeeId, employee]))
    const seenInFile = new Set()
    const periodeCache = new Map()
    const errors = []
    let created = 0

    for (const { rowNumber, values } of rows) {
      try {
        const row = parseRow(values, { currentFiscalYear, employeesById })

        const key = `${row.employeeId}:${row.fiscalYear}`
        if (seenInFile.has(key)) {
          throw new Error(`Employee ${row.employeeId} appears more than once for FY${row.fiscalYear} in this file`)
        }
        seenInFile.add(key)

        const existing = await PromotionSummary.findOne({
          where: { employeeId: row.employeeId, fiscalYear: row.fiscalYear },
          attributes: ['periodeName'],
        })
        if (existing) {
          throw new Error(
            `Employee ${row.employeeId} is already in the summary for FY${row.fiscalYear} (${existing.periodeName})`
          )
        }

        const periodeKey = `${row.fiscalYear}:${row.periodeName}`
        if (!periodeCache.has(periodeKey)) {
          await ensureFiscalYearPeriods(row.fiscalYear)
          periodeCache.set(
            periodeKey,
            await Periode.findOne({ where: { fiscalYear: row.fiscalYear, name: row.periodeName } })
          )
        }

        await PromotionSummary.create({ ...row, periodeId: periodeCache.get(periodeKey).id })
        created += 1
      } catch (error) {
        errors.push({ row: rowNumber, message: error.message })
      }
    }

    return res.status(200).json({
      message: `Upload finished: ${created} added to the summary, ${errors.length} failed`,
      created,
      failed: errors.length,
      errors,
    })
  } catch (error) {
    console.error('Upload summary error:', error)
    return res.status(500).json({ message: error.message || 'Something went wrong on the server' })
  }
}
