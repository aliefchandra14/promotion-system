import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function AdminRoute({ children }) {
  const { user } = useAuth()

  if (user?.role !== 'admin') {
    return <Navigate to="/my-promotion" replace />
  }

  return children
}

export default AdminRoute
