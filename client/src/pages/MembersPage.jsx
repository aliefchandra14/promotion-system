import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiCheck, FiX } from 'react-icons/fi'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const TABS = [
  { type: 'eligibility', label: 'Eligible Status Approver' },
  { type: 'submission', label: 'Submission Status Approver' },
]

function MembersPage() {
  const [activeTab, setActiveTab] = useState('eligibility')
  const [requests, setRequests] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [decidingId, setDecidingId] = useState(null)

  const fetchRequests = useCallback(async () => {
    setIsLoading(true)
    try {
      const [superiorRes, hodRes] = await Promise.all([
        fetch(`${API_URL}/promotions/members?type=${activeTab}&stage=superior`, {
          credentials: 'include',
        }),
        fetch(`${API_URL}/promotions/members?type=${activeTab}&stage=hod`, { credentials: 'include' }),
      ])
      const superiorData = await superiorRes.json()
      const hodData = await hodRes.json()

      if (!superiorRes.ok) throw new Error(superiorData.message || 'Failed to load data')
      if (!hodRes.ok) throw new Error(hodData.message || 'Failed to load data')

      setRequests([
        ...superiorData.requests.map((r) => ({ ...r, stage: 'superior' })),
        ...hodData.requests.map((r) => ({ ...r, stage: 'hod' })),
      ])
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const handleDecision = async (id, decision) => {
    setDecidingId(id)
    try {
      const res = await fetch(`${API_URL}/promotions/${id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ decision }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to record decision')
      }

      toast.success(data.message)
      fetchRequests()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setDecidingId(null)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">Members</h1>
      <p className="mt-1 text-sm text-slate-500">Review and approve your team's promotion status</p>

      <div className="mt-6 flex gap-2 border-b border-slate-200">
        {TABS.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            onClick={() => setActiveTab(type)}
            className={`px-4 py-2 text-sm font-medium transition ${
              activeTab === type
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
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  Loading data...
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  Nothing pending your approval
                </td>
              </tr>
            ) : (
              requests.map((req) => (
                <tr key={`${req.stage}-${req.id}`} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{req.employee?.name}</p>
                    <p className="text-xs text-slate-400">{req.employee?.employeeId}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{req.employee?.department || '-'}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{req.stage} approval</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleDecision(req.id, 'approve')}
                        disabled={decidingId === req.id}
                        className="flex items-center gap-1 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-600 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <FiCheck size={14} /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDecision(req.id, 'reject')}
                        disabled={decidingId === req.id}
                        className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <FiX size={14} /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default MembersPage
