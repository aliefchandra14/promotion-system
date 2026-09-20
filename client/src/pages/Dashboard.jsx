import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiUsers, FiUserCheck, FiCalendar, FiCheckCircle } from 'react-icons/fi'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const cards = [
  { key: 'totalEmployees', label: 'Total Employees', icon: FiUsers, color: 'bg-primary' },
  { key: 'totalActiveEmployees', label: 'Active Employees', icon: FiUserCheck, color: 'bg-secondary' },
  { key: 'totalPeriodes', label: 'Total Periods', icon: FiCalendar, color: 'bg-tertiary' },
  { key: 'totalActivePeriodes', label: 'Active Periods', icon: FiCheckCircle, color: 'bg-quaternary' },
]

function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await fetch(`${API_URL}/dashboard/summary`, { credentials: 'include' })
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.message || 'Failed to load dashboard data')
        }

        setSummary(data)
      } catch (error) {
        toast.error(error.message || 'Something went wrong, please try again')
      } finally {
        setIsLoading(false)
      }
    }

    fetchSummary()
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">Overview of the employee promotion system</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ key, label, icon: Icon, color }) => (
          <div
            key={key}
            className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${color} text-white`}>
              <Icon size={20} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">{label}</p>
              <p className="text-xl font-bold text-slate-800">
                {isLoading ? '...' : (summary?.[key] ?? 0)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Dashboard
