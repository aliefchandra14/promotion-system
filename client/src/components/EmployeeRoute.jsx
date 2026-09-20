import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function EmployeeRoute({ children }) {
  const { user } = useAuth()

  if (user?.role === 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default EmployeeRoute
