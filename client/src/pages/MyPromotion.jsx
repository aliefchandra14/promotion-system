import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiSend, FiLoader } from 'react-icons/fi'

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

function DecisionLines({ request }) {
  return (
    <div className="mt-2 space-y-1 text-sm text-slate-500">
      {request.superiorDecision && (
        <p>
          Superior:{' '}
          <span className="font-medium capitalize text-slate-700">{request.superiorDecision}</span>
          {request.superiorRemark ? ` - ${request.superiorRemark}` : ''}
        </p>
      )}
      {request.hodDecision && (
        <p>
          HOD: <span className="font-medium capitalize text-slate-700">{request.hodDecision}</span>
          {request.hodRemark ? ` - ${request.hodRemark}` : ''}
        </p>
      )}
    </div>
  )
}

function MyPromotion() {
  const [periode, setPeriode] = useState(null)
  const [requests, setRequests] = useState([])
  const [promotion, setPromotion] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`${API_URL}/promotions/me`, { credentials: 'include' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to load status')
      }

      setPeriode(data.periode)
      setRequests(data.requests)
      setPromotion(data.promotion)
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSubmitProject = async () => {
    setIsSubmitting(true)
    try {
      const res = await fetch(`${API_URL}/promotions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'submission' }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit project')
      }

      toast.success(data.message)
      fetchData()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsSubmitting(false)
    }
  }

  const eligibilityRequest = requests.find((r) => r.type === 'eligibility')
  const submissionRequest = requests.find((r) => r.type === 'submission')
  const adminDecision = promotion?.adminDecision || 'pending'

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">My Promotion</h1>

      {isLoading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
          <FiLoader className="animate-spin" size={16} />
          Loading...
        </div>
      ) : !periode ? (
        <p className="mt-4 max-w-md rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          There is no active promotion period right now. Please wait until admin activates one.
        </p>
      ) : !eligibilityRequest ? (
        <p className="mt-4 max-w-md rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          You have not been included in a promotion cycle for the "{periode.name}" period yet.
        </p>
      ) : (
        <div className="mt-6 max-w-lg space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Period: {periode.name}</p>
            <h2 className="mt-3 text-sm font-semibold text-slate-700">Eligibility Status</h2>

            <span
              className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                STATUS_STYLE[eligibilityRequest.status]
              }`}
            >
              {eligibilityRequest.status === 'approved' && adminDecision === 'pending'
                ? 'Pending Admin Approval'
                : STATUS_LABEL[eligibilityRequest.status]}
            </span>

            <DecisionLines request={eligibilityRequest} />
          </div>

          {eligibilityRequest.status === 'approved' && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700">Submission</h2>

              {adminDecision === 'pending' && (
                <p className="mt-2 text-sm text-slate-500">
                  Your eligibility has been approved. Waiting for admin to open submission access for this
                  period.
                </p>
              )}

              {adminDecision === 'summarized' && (
                <p className="mt-2 text-sm text-slate-500">
                  This promotion cycle has been finalized for you without a submission step.
                </p>
              )}

              {adminDecision === 'eligible_for_submission' && (
                <>
                  {!submissionRequest ? (
                    <div className="mt-3">
                      <p className="text-sm text-slate-500">
                        You are eligible to submit your promotion project.
                      </p>
                      <button
                        type="button"
                        onClick={handleSubmitProject}
                        disabled={isSubmitting}
                        className="mt-3 flex items-center gap-2 rounded-lg bg-quaternary px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-quaternary/30 transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <FiSend size={14} />
                        {isSubmitting ? 'Submitting...' : 'Submit Project'}
                      </button>
                    </div>
                  ) : (
                    <>
                      <span
                        className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                          STATUS_STYLE[submissionRequest.status]
                        }`}
                      >
                        {STATUS_LABEL[submissionRequest.status]}
                      </span>
                      <DecisionLines request={submissionRequest} />
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default MyPromotion
