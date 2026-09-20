import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import EmployeeRoute from './components/EmployeeRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import ChangePassword from './pages/ChangePassword'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const EmployeePage = lazy(() => import('./pages/EmployeePage'))
const PeriodePage = lazy(() => import('./pages/PeriodePage'))
const EmployeePromotionPage = lazy(() => import('./pages/EmployeePromotionPage'))
const MyPromotion = lazy(() => import('./pages/MyPromotion'))
const PromotionStatusPage = lazy(() => import('./pages/PromotionStatusPage'))
const MembersPage = lazy(() => import('./pages/MembersPage'))
const JudgesPage = lazy(() => import('./pages/JudgesPage'))

const PageFallback = () => <p className="p-6 text-sm text-slate-400">Loading...</p>

function App() {
  return (
    <BrowserRouter basename="/promotionsystem">
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/change-password" element={<ChangePassword />} />

            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route
                path="/dashboard"
                element={
                  <AdminRoute>
                    <Dashboard />
                  </AdminRoute>
                }
              />
              <Route
                path="/employee"
                element={
                  <AdminRoute>
                    <EmployeePage />
                  </AdminRoute>
                }
              />
              <Route
                path="/period"
                element={
                  <AdminRoute>
                    <PeriodePage />
                  </AdminRoute>
                }
              />
              <Route
                path="/employee-promotion"
                element={
                  <AdminRoute>
                    <EmployeePromotionPage />
                  </AdminRoute>
                }
              />
              <Route
                path="/my-promotion"
                element={
                  <EmployeeRoute>
                    <MyPromotion />
                  </EmployeeRoute>
                }
              />
              <Route
                path="/eligibility"
                element={
                  <EmployeeRoute>
                    <PromotionStatusPage type="eligibility" label="Eligibility" />
                  </EmployeeRoute>
                }
              />
              <Route
                path="/submission"
                element={
                  <EmployeeRoute>
                    <PromotionStatusPage type="submission" label="Submission" />
                  </EmployeeRoute>
                }
              />
              <Route path="/members" element={<MembersPage />} />
              <Route path="/judges" element={<JudgesPage />} />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
