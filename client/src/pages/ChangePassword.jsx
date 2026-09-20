import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FiUser, FiLock, FiEye, FiEyeOff, FiLoader, FiArrowLeft } from 'react-icons/fi'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

function ChangePassword() {
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const defaultEmployeeId = location.state?.employeeId || ''

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: 'onBlur',
    defaultValues: { employeeId: defaultEmployeeId },
  })

  const newPassword = watch('newPassword')

  const onSubmit = async (values) => {
    try {
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(values),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to change password')
      }

      toast.success(data.message || 'Password changed successfully')
      navigate('/login')
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    }
  }

  const fieldClass = (hasError) =>
    `w-full rounded-lg border bg-white py-2.5 pl-10 pr-10 text-sm text-slate-800 outline-none transition focus:ring-2 ${
      hasError
        ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
        : 'border-slate-200 focus:border-tertiary focus:ring-tertiary/20'
    }`

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-sm">
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mb-6 flex items-center gap-1.5 text-sm font-medium text-secondary hover:text-primary"
        >
          <FiArrowLeft size={16} /> Back to login
        </button>

        <div className="mb-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary font-bold text-white">
            P
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Change Password</h2>
          <p className="mt-1 text-sm text-slate-500">
            This is your first login, please set a new password before continuing
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div>
            <label htmlFor="employeeId" className="mb-1.5 block text-sm font-medium text-slate-700">
              Employee ID
            </label>
            <div className="relative">
              <FiUser
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                id="employeeId"
                type="text"
                inputMode="numeric"
                maxLength={6}
                disabled={isSubmitting}
                className={fieldClass(errors.employeeId).replace('pr-10', 'pr-3')}
                {...register('employeeId', {
                  required: 'Employee ID is required',
                  pattern: { value: /^[0-9]{6}$/, message: 'Employee ID must be 6 digits' },
                })}
              />
            </div>
            {errors.employeeId && (
              <p className="mt-1.5 text-xs text-red-500">{errors.employeeId.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="oldPassword" className="mb-1.5 block text-sm font-medium text-slate-700">
              Old Password
            </label>
            <div className="relative">
              <FiLock
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                id="oldPassword"
                type={showOld ? 'text' : 'password'}
                autoComplete="current-password"
                disabled={isSubmitting}
                className={fieldClass(errors.oldPassword)}
                {...register('oldPassword', { required: 'Old password is required' })}
              />
              <button
                type="button"
                onClick={() => setShowOld((prev) => !prev)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                tabIndex={-1}
              >
                {showOld ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
            {errors.oldPassword && (
              <p className="mt-1.5 text-xs text-red-500">{errors.oldPassword.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="newPassword" className="mb-1.5 block text-sm font-medium text-slate-700">
              New Password
            </label>
            <div className="relative">
              <FiLock
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                id="newPassword"
                type={showNew ? 'text' : 'password'}
                autoComplete="new-password"
                disabled={isSubmitting}
                className={fieldClass(errors.newPassword)}
                {...register('newPassword', {
                  required: 'New password is required',
                  minLength: { value: 8, message: 'New password must be at least 8 characters' },
                })}
              />
              <button
                type="button"
                onClick={() => setShowNew((prev) => !prev)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                tabIndex={-1}
              >
                {showNew ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="mt-1.5 text-xs text-red-500">{errors.newPassword.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-slate-700">
              Confirm New Password
            </label>
            <div className="relative">
              <FiLock
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                disabled={isSubmitting}
                className={fieldClass(errors.confirmPassword)}
                {...register('confirmPassword', {
                  required: 'Password confirmation is required',
                  validate: (value) => value === newPassword || 'Passwords do not match',
                })}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((prev) => !prev)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                tabIndex={-1}
              >
                {showConfirm ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1.5 text-xs text-red-500">{errors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-quaternary py-2.5 text-sm font-semibold text-white shadow-sm shadow-quaternary/30 transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting && <FiLoader className="animate-spin" size={16} />}
            {isSubmitting ? 'Saving...' : 'Save New Password'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ChangePassword
