import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const TABS = [
  { key: 'presentation', label: 'Presentation List' },
  { key: 'task', label: 'Task List' },
]

function JudgesPage() {
  const [activeTab, setActiveTab] = useState('presentation')
  const [employees, setEmployees] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchAssignments = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`${API_URL}/promotions/judging`, { credentials: 'include' })
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.message || 'Failed to load judging assignments')
        }

        setEmployees(data.employees)
      } catch (error) {
        toast.error(error.message || 'Something went wrong, please try again')
      } finally {
        setIsLoading(false)
      }
    }

    fetchAssignments()
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">Judges</h1>
      <p className="mt-1 text-sm text-slate-500">Employees assigned for you to judge</p>

      <div className="mt-6 flex gap-2 border-b border-slate-200">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium transition ${
              activeTab === key
                ? 'border-b-2 border-quaternary text-quaternary'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Employee ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Grade</th>
              <th className="px-4 py-3">{activeTab === 'presentation' ? 'Schedule' : 'Status'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Loading data...
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  You are not assigned to judge anyone yet
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.employeeId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{emp.employeeId}</td>
                  <td className="px-4 py-3 text-slate-600">{emp.name}</td>
                  <td className="px-4 py-3 text-slate-600">{emp.department || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{emp.grade || '-'}</td>
                  <td className="px-4 py-3 text-slate-400">To be scheduled</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default JudgesPage
