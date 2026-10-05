import { useCallback, useEffect, useState } from 'react'
import { FiLoader, FiTable, FiBarChart2 } from 'react-icons/fi'
import { getFiscalYearLabel } from '../constants/fiscalYear'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

// One hue per promotion path, used the same way in every chart (validated categorical slots 1-3:
// adjacent CVD ΔE ≥ 9, normal-vision ΔE ≥ 27). PTC sits below 3:1 on white, so every bar carries
// a visible value label and the table view is always available.
const PATH = {
  normal: { label: 'Normal', color: '#2a78d6', track: '#cde2fb' },
  special: { label: 'Special', color: '#eb6834' },
  ptc: { label: 'PTC', color: '#1baf7a' },
}

const percent = (value, total) => (total ? `${Math.round((value / total) * 1000) / 10}%` : '-')

// Bars sized against the FY's total input, so lengths compare across all three charts.
function BarChart({ title, subtitle, rows, scaleMax, total, onHover }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        </div>
        <p className="text-2xl font-semibold text-slate-800">{total}</p>
      </div>

      <ul className="mt-4 space-y-3">
        {rows.map((row) => {
          const width = scaleMax ? Math.min((row.value / scaleMax) * 100, 100) : 0
          const tooltip = `${row.path.label} · ${row.label}: ${row.value} (${percent(row.value, scaleMax)} of input)`
          return (
            <li key={row.label}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-600">{row.label}</span>
              </div>
              <div
                className="group mt-1 flex h-7 items-center gap-2 rounded outline-none focus-visible:ring-2 focus-visible:ring-tertiary/40"
                tabIndex={0}
                aria-label={tooltip}
                onPointerMove={(e) => onHover({ text: tooltip, x: e.clientX, y: e.clientY })}
                onPointerLeave={() => onHover(null)}
                onFocus={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  onHover({ text: tooltip, x: rect.left + 16, y: rect.top })
                }}
                onBlur={() => onHover(null)}
              >
                <div className="h-5 flex-1 rounded-r-sm border-l border-slate-300">
                  {row.value > 0 && (
                    <div
                      className="h-full rounded-r transition group-hover:brightness-110"
                      style={{ width: `${Math.max(width, 1.5)}%`, backgroundColor: row.path.color }}
                    />
                  )}
                </div>
                <span className="w-10 shrink-0 text-right text-sm font-semibold text-slate-700">{row.value}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function StatsTable({ stats }) {
  const { input, output1, output2, completion } = stats
  const sections = [
    {
      title: 'Input 1 – employees in promotion',
      rows: [
        ['Normal path', input.normal],
        ['Special path', input.special],
        ['PTC path', input.ptc],
        ['Total', input.total],
      ],
    },
    {
      title: 'Output 1 – Normal path (incl. PTC)',
      rows: [
        ['Passed with presentation', output1.withPresentation],
        ['Passed without presentation', output1.withoutPresentation],
        ['PTC', output1.ptc],
        ['Delayed 6 months', output1.delayed],
        ['Not passed', output1.failed],
        ['Total', output1.total],
      ],
    },
    {
      title: 'Output 2 – Special path',
      rows: [
        ['Passed with presentation', output2.withPresentation],
        ['Passed without presentation', output2.withoutPresentation],
        ['Delayed 6 months', output2.delayed],
        ['Not passed', output2.failed],
        ['Total', output2.total],
      ],
    },
    {
      title: 'Input 2 – (Output 1 + Output 2) : Input 1',
      rows: [
        ['Output 1 + Output 2', completion.processed],
        ['Input 1', completion.input],
        ['Ratio', completion.rate == null ? '-' : `${completion.rate}%`],
      ],
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {sections.map((section) => (
        <div key={section.title} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <caption className="bg-slate-50 px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-500">
              {section.title}
            </caption>
            <tbody className="divide-y divide-slate-100">
              {section.rows.map(([label, value]) => (
                <tr key={label} className={label === 'Total' ? 'font-semibold' : ''}>
                  <td className="px-4 py-2 text-slate-600">{label}</td>
                  <td className="px-4 py-2 text-right text-slate-800">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

function PromotionStats() {
  const [stats, setStats] = useState(null)
  const [fiscalYear, setFiscalYear] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [view, setView] = useState('chart')
  const [tooltip, setTooltip] = useState(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const params = fiscalYear ? `?fiscalYear=${fiscalYear}` : ''
      const res = await fetch(`${API_URL}/dashboard/promotion-stats${params}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to load promotion statistics')
      setStats(data)
    } catch (error) {
      setLoadError(error.message || 'Something went wrong, please try again')
    } finally {
      setIsLoading(false)
    }
  }, [fiscalYear])

  useEffect(() => {
    load()
  }, [load])

  const input = stats?.input
  const output1 = stats?.output1
  const output2 = stats?.output2
  const completion = stats?.completion
  const scaleMax = input?.total || 0

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Promotion Overview</h2>
          <p className="text-sm text-slate-500">Input and results per promotion path</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={stats ? String(stats.fiscalYear) : fiscalYear}
            onChange={(e) => setFiscalYear(e.target.value)}
            aria-label="Fiscal year"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-tertiary focus:ring-2 focus:ring-tertiary/20"
          >
            {(stats?.fiscalYears || []).map((fy) => (
              <option key={fy} value={fy}>
                {getFiscalYearLabel(fy)}
              </option>
            ))}
          </select>
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
            {[
              { key: 'chart', label: 'Chart', icon: FiBarChart2 },
              { key: 'table', label: 'Table', icon: FiTable },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                aria-pressed={view === key}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  view === key ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading && !stats ? (
        <div className="mt-4 flex min-h-40 items-center justify-center rounded-xl border border-slate-200 bg-white">
          <FiLoader className="animate-spin text-slate-400" size={22} />
        </div>
      ) : loadError ? (
        <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-8 text-center">
          <p className="text-sm text-red-500">{loadError}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 rounded-lg bg-quaternary px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-quaternary/90"
          >
            Try Again
          </button>
        </div>
      ) : (
        <div className={`mt-4 space-y-4 transition-opacity ${isLoading ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Input 1', input.total, 'Employees in promotion'],
              ['Output 1', output1.total, 'Normal path results (incl. PTC)'],
              ['Output 2', output2.total, 'Special path results'],
            ].map(([label, value, hint]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <p className="mt-1 text-3xl font-semibold text-slate-800">{value}</p>
                <p className="mt-1 text-xs text-slate-400">{hint}</p>
              </div>
            ))}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500">Input 2 · (Output 1 + Output 2) : Input 1</p>
              <p className="mt-1 text-3xl font-semibold text-slate-800">
                {completion.rate == null ? '-' : `${completion.rate}%`}
              </p>
              <div
                className="mt-2 h-2 rounded-full"
                style={{ backgroundColor: PATH.normal.track }}
                role="meter"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={completion.rate ?? 0}
                aria-label="Completion ratio"
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(completion.rate ?? 0, 100)}%`, backgroundColor: PATH.normal.color }}
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                {completion.processed} of {completion.input} employees have a result
              </p>
            </div>
          </div>

          {view === 'table' ? (
            <StatsTable stats={stats} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              <BarChart
                title="Input 1 · Employees by path"
                subtitle={`${getFiscalYearLabel(stats.fiscalYear)} · Normal + Special + PTC`}
                total={input.total}
                scaleMax={scaleMax}
                onHover={setTooltip}
                rows={[
                  { label: 'Normal path', value: input.normal, path: PATH.normal },
                  { label: 'Special path', value: input.special, path: PATH.special },
                  { label: 'PTC path', value: input.ptc, path: PATH.ptc },
                ]}
              />
              <BarChart
                title="Output 1 · Normal path"
                subtitle="Results of the normal path, including PTC"
                total={output1.total}
                scaleMax={scaleMax}
                onHover={setTooltip}
                rows={[
                  { label: 'Passed with presentation', value: output1.withPresentation, path: PATH.normal },
                  { label: 'Passed without presentation', value: output1.withoutPresentation, path: PATH.normal },
                  { label: 'PTC', value: output1.ptc, path: PATH.ptc },
                  { label: 'Delayed 6 months', value: output1.delayed, path: PATH.normal },
                  { label: 'Not passed', value: output1.failed, path: PATH.normal },
                ]}
              />
              <BarChart
                title="Output 2 · Special path"
                subtitle="Results of the special path"
                total={output2.total}
                scaleMax={scaleMax}
                onHover={setTooltip}
                rows={[
                  { label: 'Passed with presentation', value: output2.withPresentation, path: PATH.special },
                  { label: 'Passed without presentation', value: output2.withoutPresentation, path: PATH.special },
                  { label: 'Delayed 6 months', value: output2.delayed, path: PATH.special },
                  { label: 'Not passed', value: output2.failed, path: PATH.special },
                ]}
              />
            </div>
          )}

          {view === 'chart' && (
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
              {Object.values(PATH).map((path) => (
                <span key={path.label} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: path.color }} />
                  {path.label} path
                </span>
              ))}
              <span className="text-slate-400">Bar length = share of Input 1</span>
            </div>
          )}
        </div>
      )}

      {tooltip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y - 36 }}
        >
          {tooltip.text}
        </div>
      )}
    </section>
  )
}

export default PromotionStats
