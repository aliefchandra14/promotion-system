import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FiUser, FiLock, FiEye, FiEyeOff, FiLoader, FiTool } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [maintenanceNotice, setMaintenanceNotice] = useState('')
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ mode: 'onBlur' })

  const onSubmit = async ({ employeeId, password }) => {
    setMaintenanceNotice('')
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ employeeId, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 503) {
          setMaintenanceNotice(data.message || 'The system is currently under maintenance.')
          return
        }
        throw new Error(data.message || 'Login failed')
      }

      if (data.requireChangePassword) {
        toast(data.message || 'Please change your password first', { icon: '🔒' })
        navigate('/change-password', { state: { employeeId: data.employeeId } })
        return
      }

      toast.success(`Welcome, ${data.user.name}`)
      setUser(data.user)
      navigate('/dashboard')
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left branding panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-secondary to-tertiary p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-10 h-80 w-80 rounded-full bg-quaternary/20" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-quaternary font-bold text-white">
              P
            </div>
            <span className="text-lg font-semibold tracking-wide">Promotion System</span>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="text-4xl font-bold leading-tight">
            Manage employee promotions with ease
          </h1>
          <p className="mt-4 text-white/70">
            One unified platform for submitting, reviewing, and approving employee
            job promotions.
          </p>
        </div>

        <div className="relative z-10 text-sm text-white/50">
          © {new Date().getFullYear()} Promotion System. All rights reserved.
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex w-full flex-col items-center justify-center bg-slate-50 px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary font-bold text-white lg:hidden">
              P
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Sign in to your account</h2>
            <p className="mt-1 text-sm text-slate-500">
              Use your Employee ID and password to sign in
            </p>
          </div>

          {maintenanceNotice && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <FiTool className="mt-0.5 shrink-0" size={16} />
              <span>{maintenanceNotice}</span>
            </div>
          )}

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
                  autoComplete="username"
                  placeholder="6-digit number, e.g. 102938"
                  disabled={isSubmitting}
                  className={`w-full rounded-lg border bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:ring-2 ${
                    errors.employeeId
                      ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                      : 'border-slate-200 focus:border-tertiary focus:ring-tertiary/20'
                  }`}
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
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <FiLock
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  disabled={isSubmitting}
                  className={`w-full rounded-lg border bg-white py-2.5 pl-10 pr-10 text-sm text-slate-800 outline-none transition focus:ring-2 ${
                    errors.password
                      ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                      : 'border-slate-200 focus:border-tertiary focus:ring-tertiary/20'
                  }`}
                  {...register('password', { required: 'Password is required' })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-500">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-quaternary focus:ring-quaternary/30"
                />
                Remember me
              </label>
              <a href="#" className="font-medium text-secondary hover:text-primary">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-quaternary py-2.5 text-sm font-semibold text-white shadow-sm shadow-quaternary/30 transition hover:bg-quaternary/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting && <FiLoader className="animate-spin" size={16} />}
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Login
