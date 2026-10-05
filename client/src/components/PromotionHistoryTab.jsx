import { useCallback, useEffect, useState } from 'react'
import { FiLoader } from 'react-icons/fi'
import { getFiscalYearLabel } from '../constants/fiscalYear'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const STATUS_STYLE = {
  'Not Recommended': 'bg-red-50 text-red-500',
}

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

// The employee's finished promotions (from the summary), newest first.
function PromotionHistoryTab() {
  const [summaries, setSummaries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    setLoadError('')
    try {
      const res = await fetch(`${API_URL}/summaries/me`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to load promotion history')
      setSummaries(data.summaries)
    } catch (error) {
      setLoadError(error.message || 'Something went wrong, please try again')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const columnCount = 8

  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-max min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="whitespace-nowrap px-4 py-3">FY</th>
            <th className="whitespace-nowrap px-4 py-3">Period</th>
            <th className="whitespace-nowrap px-4 py-3">Current Grade</th>
            <th className="whitespace-nowrap px-4 py-3">Promote Grade</th>
            <th className="whitespace-nowrap px-4 py-3">Type</th>
            <th className="whitespace-nowrap px-4 py-3">Presentation</th>
            <th className="whitespace-nowrap px-4 py-3">Result</th>
            <th className="whitespace-nowrap px-4 py-3">Remark</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {isLoading ? (
            <tr>
              <td colSpan={columnCount} className="px-4 py-10 text-center text-slate-400">
                <FiLoader className="mx-auto animate-spin" size={20} />
              </td>
            </tr>
          ) : loadError ? (
            <tr>
              <td colSpan={columnCount} className="px-4 py-10 text-center">
                <p className="text-sm text-red-500">{loadError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setIsLoading(true)
                    load()
                  }}
                  className="mt-3 rounded-lg bg-quaternary px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-quaternary/90"
                >
                  Try Again
                </button>
              </td>
            </tr>
          ) : summaries.length === 0 ? (
            <tr>
              <td colSpan={columnCount} className="px-4 py-6 text-center text-slate-400">
                You have no promotion history yet
              </td>
            </tr>
          ) : (
            summaries.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">
                  {getFiscalYearLabel(row.fiscalYear)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {row.periodeName}
                  <p className="text-xs text-slate-400">{formatDate(row.createdAt)}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{row.currentGrade || '-'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{row.promoteGrade || '-'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{row.type || '-'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{row.presentation}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      STATUS_STYLE[row.status] || 'bg-green-50 text-green-600'
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="max-w-72 whitespace-pre-line px-4 py-3 text-slate-600">{row.remark || '-'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default PromotionHistoryTab
