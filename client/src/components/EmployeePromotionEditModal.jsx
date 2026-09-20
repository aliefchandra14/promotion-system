import { useState } from 'react'
import toast from 'react-hot-toast'
import { FiX } from 'react-icons/fi'
import { GRADES } from '../constants/grades'
import { DEPARTMENTS } from '../constants/departments'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-tertiary focus:ring-2 focus:ring-tertiary/20'

function EmployeePromotionEditModal({ promotion, onClose, onSaved }) {
  const [form, setForm] = useState({
    department: promotion.department || '',
    currentGrade: promotion.currentGrade || '',
    promoteGrade: promotion.promoteGrade || '',
    type: promotion.type || '',
    presentation: promotion.presentation || 'NO',
    status: promotion.status || 'NORMAL',
    remark: promotion.remark || '',
  })
  const [isSaving, setIsSaving] = useState(false)

  const handleChange = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const res = await fetch(`${API_URL}/employee-promotions/${promotion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to update record')
      }

      toast.success(data.message)
      onSaved()
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Edit Promotion Record</h2>
            <p className="text-xs text-slate-500">
              {promotion.employeeId} - {promotion.name}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <FiX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Current Grade</label>
              <select value={form.currentGrade} onChange={handleChange('currentGrade')} className={inputClass}>
                <option value="">-</option>
                {GRADES.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Promote Grade</label>
              <select value={form.promoteGrade} onChange={handleChange('promoteGrade')} className={inputClass}>
                <option value="">-</option>
                {GRADES.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Type</label>
            <input value={form.type} onChange={handleChange('type')} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Presentation</label>
              <select value={form.presentation} onChange={handleChange('presentation')} className={inputClass}>
                <option value="YES">YES</option>
                <option value="NO">NO</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
              <select value={form.status} onChange={handleChange('status')} className={inputClass}>
                <option value="NORMAL">NORMAL</option>
                <option value="SPECIAL">SPECIAL</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Remark</label>
            <textarea
              value={form.remark}
              onChange={handleChange('remark')}
              rows={3}
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-lg bg-quaternary py-2 text-sm font-semibold text-white transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default EmployeePromotionEditModal
