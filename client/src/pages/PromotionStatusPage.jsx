import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiSend } from 'react-icons/fi'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const STATUS_LABEL = {
  pending_superior: 'Waiting for Superior Approval',
  pending_hod: 'Waiting for HOD Approval',
  approved: 'Approved',
  rejected: 'Rejected',
}

const STATUS_STYLE = {
  pending_superior: 'bg-amber-50 text-amber-600',
  pending_hod: 'bg-amber-50 text-amber-600',
  approved: 'bg-green-50 text-green-600',
  rejected: 'bg-red-50 text-red-500',
}

function PromotionStatusPage({ type, label }) {
  const [periode, setPeriode] = useState(null)
  const [request, setRequest] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isStarting, setIsStarting] = useState(false)

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`${API_URL}/promotions/me`, { credentials: 'include' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to load status')
      }

      setPeriode(data.periode)
      setRequest(data.requests.find((r) => r.type === type) || null)
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  const handleStart = async () => {
    setIsStarting(true)
    try {
      const res = await fetch(`${API_URL}/promotions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit request')
      }

      toast.success(data.message)
      fetchData()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsStarting(false)
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-400">Loading...</p>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">{label}</h1>

      {!periode ? (
        <p className="mt-4 max-w-md rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          There is no active promotion period right now. Please wait until admin activates one.
        </p>
      ) : (
        <div className="mt-6 max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Period: {periode.name}</p>

          {!request ? (
            <button
              type="button"
              onClick={handleStart}
              disabled={isStarting}
              className="mt-4 flex items-center gap-2 rounded-lg bg-quaternary px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-quaternary/30 transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <FiSend size={14} />
              {isStarting ? 'Submitting...' : `Start ${label}`}
            </button>
          ) : (
            <div className="mt-4 space-y-2 text-sm">
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[request.status]}`}
              >
                {STATUS_LABEL[request.status]}
              </span>
              <div className="space-y-1 text-slate-500">
                {request.superiorDecision && (
                  <p>
                    Superior:{' '}
                    <span className="font-medium capitalize text-slate-700">
                      {request.superiorDecision}
                    </span>
                    {request.superiorRemark ? ` - ${request.superiorRemark}` : ''}
                  </p>
                )}
                {request.hodDecision && (
                  <p>
                    HOD:{' '}
                    <span className="font-medium capitalize text-slate-700">{request.hodDecision}</span>
                    {request.hodRemark ? ` - ${request.hodRemark}` : ''}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default PromotionStatusPage
