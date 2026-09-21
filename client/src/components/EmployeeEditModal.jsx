import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiX, FiTrash2, FiPlus } from 'react-icons/fi'
import { DEPARTMENTS } from '../constants/departments'
import { GRADES } from '../constants/grades'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-tertiary focus:ring-2 focus:ring-tertiary/20'

function EmployeeEditModal({ employee, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: employee.name || '',
    email: employee.email || '',
    department: employee.department || '',
    grade: employee.grade || '',
    trainer: employee.trainer || '',
    superior: employee.superior || '',
    hod: employee.hod || '',
  })
  const [isSaving, setIsSaving] = useState(false)

  const [judges, setJudges] = useState([])
  const [newJudgeId, setNewJudgeId] = useState('')
  const [isJudgesLoading, setIsJudgesLoading] = useState(true)
  const [isAddingJudge, setIsAddingJudge] = useState(false)

  const fetchJudges = async () => {
    setIsJudgesLoading(true)
    try {
      const res = await fetch(`${API_URL}/employees/${employee.employeeId}/judges`, {
        credentials: 'include',
      })
      const data = await res.json()
      if (res.ok) setJudges(data.judges)
    } catch {
      // judges list is secondary, ignore failures here
    } finally {
      setIsJudgesLoading(false)
    }
  }

  useEffect(() => {
    fetchJudges()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee.employeeId])

  const handleChange = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSave = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const res = await fetch(`${API_URL}/employees/${employee.employeeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to update employee')
      }

      toast.success(data.message)
      onSaved()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddJudge = async () => {
    if (!newJudgeId.trim()) return

    setIsAddingJudge(true)
    try {
      const res = await fetch(`${API_URL}/employees/${employee.employeeId}/judges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ judgeId: newJudgeId.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to add judge')
      }

      toast.success(data.message)
      setNewJudgeId('')
      fetchJudges()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsAddingJudge(false)
    }
  }

  const handleRemoveJudge = async (judgeId) => {
    try {
      const res = await fetch(`${API_URL}/employees/${employee.employeeId}/judges/${judgeId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to remove judge')
      }

      setJudges((prev) => prev.filter((judge) => judge.employeeId !== judgeId))
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Edit Employee</h2>
            <p className="text-xs text-slate-500">
              {employee.employeeId} - {employee.name}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <FiX size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Name</label>
              <input value={form.name} onChange={handleChange('name')} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
              <input value={form.email} onChange={handleChange('email')} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Department</label>
              <select value={form.department} onChange={handleChange('department')} className={inputClass}>
                <option value="">-</option>
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Grade</label>
              <select value={form.grade} onChange={handleChange('grade')} className={inputClass}>
                <option value="">-</option>
                {GRADES.map((grade) => (
                  <option key={grade.step} value={grade.title}>
                    {grade.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Trainer ID</label>
              <input
                value={form.trainer}
                onChange={handleChange('trainer')}
                maxLength={6}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Superior ID</label>
              <input
                value={form.superior}
                onChange={handleChange('superior')}
                maxLength={6}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">HOD ID</label>
              <input value={form.hod} onChange={handleChange('hod')} maxLength={6} className={inputClass} />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-lg bg-quaternary py-2 text-sm font-semibold text-white transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>

        <div className="border-t border-slate-200 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-800">Judges</h3>
          <p className="mt-0.5 text-xs text-slate-500">People assigned to judge this employee</p>

          <div className="mt-3 flex gap-2">
            <input
              value={newJudgeId}
              onChange={(e) => setNewJudgeId(e.target.value)}
              placeholder="6-digit employee ID"
              maxLength={6}
              className={inputClass}
            />
            <button
              type="button"
              onClick={handleAddJudge}
              disabled={isAddingJudge}
              className="flex items-center gap-1 whitespace-nowrap rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-white transition hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <FiPlus size={14} /> Add
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {isJudgesLoading ? (
              <p className="text-xs text-slate-400">Loading judges...</p>
            ) : judges.length === 0 ? (
              <p className="text-xs text-slate-400">No judges assigned yet</p>
            ) : (
              judges.map((judge) => (
                <div
                  key={judge.employeeId}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <span className="text-slate-700">
                    {judge.name} <span className="text-slate-400">({judge.employeeId})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveJudge(judge.employeeId)}
                    className="text-red-400 hover:text-red-600"
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmployeeEditModal
