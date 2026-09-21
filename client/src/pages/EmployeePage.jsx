import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiSearch, FiUpload, FiArrowUp, FiArrowDown, FiEdit2 } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import Pagination from '../components/Pagination'
import EmployeeEditModal from '../components/EmployeeEditModal'
import ImportEmployeeModal from '../components/ImportEmployeeModal'
import { useTableQueryState } from '../hooks/useTableQueryState'
import { DEPARTMENTS } from '../constants/departments'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const LIMIT = 10

const columns = [
  { field: 'employeeId', label: 'Employee ID' },
  { field: 'name', label: 'Name' },
  { field: 'department', label: 'Department' },
  { field: 'grade', label: 'Grade' },
  { field: 'role', label: 'Role' },
]

function EmployeePage() {
  const { user } = useAuth()

  const [employees, setEmployees] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(null)

  const [table, updateTable] = useTableQueryState({
    search: '',
    department: '',
    status: '',
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    page: 1,
  })
  const { search: debouncedSearch, department, status, sortBy, sortOrder, page } = table

  const [searchInput, setSearchInput] = useState(debouncedSearch)

  const isAdmin = user?.role === 'admin'
  const columnCount = columns.length + 1 + (isAdmin ? 1 : 0)

  useEffect(() => {
    const timer = setTimeout(() => {
      updateTable({ search: searchInput }, { resetPage: true })
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        search: debouncedSearch,
        department,
        status,
        sortBy,
        sortOrder,
        page: String(page),
        limit: String(LIMIT),
      })

      const res = await fetch(`${API_URL}/employees?${params.toString()}`, { credentials: 'include' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to load employee data')
      }

      setEmployees(data.employees)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (error) {
      toast.error(error.message || 'Something went wrong, please try again')
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, department, status, sortBy, sortOrder, page])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  const handleSort = (field) => {
    if (sortBy === field) {
      updateTable({ sortOrder: sortOrder === 'ASC' ? 'DESC' : 'ASC' }, { resetPage: true })
    } else {
      updateTable({ sortBy: field, sortOrder: 'ASC' }, { resetPage: true })
    }
  }

  const handleImported = () => {
    setShowImportModal(false)
    updateTable({ page: 1 })
    fetchEmployees()
  }

  const renderSortIcon = (field) => {
    if (sortBy !== field) return <span className="text-slate-300">↕</span>
    return sortOrder === 'ASC' ? <FiArrowUp size={14} /> : <FiArrowDown size={14} />
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Employee</h1>
          <p className="mt-1 text-sm text-slate-500">List of all employees</p>
        </div>

        {isAdmin && (
          <div>
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 rounded-lg bg-quaternary px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-quaternary/30 transition hover:bg-quaternary/90"
            >
              <FiUpload size={16} />
              Import Excel
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-50 flex-1">
          <FiSearch
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by ID, name, or email"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-tertiary focus:ring-2 focus:ring-tertiary/20"
          />
        </div>

        <select
          value={department}
          onChange={(e) => updateTable({ department: e.target.value }, { resetPage: true })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-tertiary focus:ring-2 focus:ring-tertiary/20"
        >
          <option value="">All Departments</option>
          {DEPARTMENTS.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => updateTable({ status: e.target.value }, { resetPage: true })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-tertiary focus:ring-2 focus:ring-tertiary/20"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {columns.map(({ field, label }) => (
                <th key={field} className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleSort(field)}
                    className="flex items-center gap-1.5 font-medium uppercase text-slate-500 hover:text-slate-700"
                  >
                    {label}
                    {renderSortIcon(field)}
                  </button>
                </th>
              ))}
              <th className="px-4 py-3">Status</th>
              {isAdmin && <th className="px-4 py-3">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-6 text-center text-slate-400">
                  Loading data...
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-6 text-center text-slate-400">
                  No employee data found
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{emp.employeeId}</td>
                  <td className="px-4 py-3 text-slate-600">{emp.name}</td>
                  <td className="px-4 py-3 text-slate-600">{emp.department || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{emp.grade || '-'}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{emp.role}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        emp.isActive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                      }`}
                    >
                      {emp.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setEditingEmployee(emp)}
                        className="flex items-center gap-1 text-xs font-medium text-secondary hover:text-primary"
                      >
                        <FiEdit2 size={13} /> Edit
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={LIMIT}
          onPageChange={(newPage) => updateTable({ page: newPage })}
        />
      </div>

      {editingEmployee && (
        <EmployeeEditModal
          employee={editingEmployee}
          onClose={() => setEditingEmployee(null)}
          onSaved={() => {
            setEditingEmployee(null)
            fetchEmployees()
          }}
        />
      )}

      {showImportModal && (
        <ImportEmployeeModal onClose={() => setShowImportModal(false)} onImported={handleImported} />
      )}
    </div>
  )
}

export default EmployeePage
