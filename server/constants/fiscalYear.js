// Fiscal year runs April - March. A date in Apr 2026 - Mar 2027 belongs to FY2026.
export const getFiscalYear = (date = new Date()) => {
  const d = new Date(date)
  const month = d.getMonth() + 1
  const year = d.getFullYear()
  return month >= 4 ? year : year - 1
}

export const getCurrentFiscalYear = () => getFiscalYear(new Date())

export const getFiscalYearLabel = (fiscalYear) => `FY${fiscalYear}`

export const getFiscalYearOptions = (yearsBefore = 3, yearsAfter = 2) => {
  const current = getCurrentFiscalYear()
  const options = []
  for (let fy = current - yearsBefore; fy <= current + yearsAfter; fy += 1) {
    options.push(fy)
  }
  return options
}
