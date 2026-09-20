import { NavLink, Outlet } from 'react-router-dom'
import {
  FiGrid,
  FiUsers,
  FiCalendar,
  FiTrendingUp,
  FiAward,
  FiCheckSquare,
  FiSend,
  FiUserCheck,
  FiFlag,
  FiLogOut,
} from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: FiGrid, show: (user) => user?.role === 'admin' },
  { to: '/employee', label: 'Employee', icon: FiUsers, show: (user) => user?.role === 'admin' },
  { to: '/period', label: 'Period', icon: FiCalendar, show: (user) => user?.role === 'admin' },
  {
    to: '/employee-promotion',
    label: 'Employee Promotion',
    icon: FiTrendingUp,
    show: (user) => user?.role === 'admin',
  },
  { to: '/my-promotion', label: 'My Promotion', icon: FiAward, show: (user) => user?.role !== 'admin' },
  { to: '/eligibility', label: 'Eligibility', icon: FiCheckSquare, show: (user) => user?.role !== 'admin' },
  { to: '/submission', label: 'Submission', icon: FiSend, show: (user) => user?.role !== 'admin' },
  { to: '/members', label: 'Members', icon: FiUserCheck, show: (user) => user?.isSuperiorOrHod },
  { to: '/judges', label: 'Judges', icon: FiFlag, show: (user) => user?.isJudge },
]

function Layout() {
  const { user, logout } = useAuth()
  const visibleItems = navItems.filter(({ show }) => show(user))

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-64 flex-col bg-primary text-white">
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-quaternary font-bold">
            P
          </div>
          <span className="text-lg font-semibold">Promotion System</span>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {visibleItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-quaternary text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <FiLogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-slate-200 bg-white px-6 py-4">
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
            <p className="text-xs capitalize text-slate-500">{user?.grade || user?.role}</p>
          </div>
        </header>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
