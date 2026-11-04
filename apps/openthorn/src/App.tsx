import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { getErrorMessage, logError } from './lib/errors'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute'
import AdminGuard from './components/AdminGuard/AdminGuard'
import styles from './App.module.css'

// Embedded in SmartVideo as the Website Builder studio: the app opens straight
// on the Dashboard. The upstream marketing pages (landing, blog, pricing, FAQ,
// compare, legal, community) are not routed; every such URL redirects to
// /dashboard. Route pages stay code-split so the builder/preview stack
// (esbuild-wasm, jszip, html2canvas, the agent) loads only when needed.
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ProjectBuilderPage = lazy(() => import('./pages/ProjectBuilderPage'))
const ProvidersPage = lazy(() => import('./pages/ProvidersPage'))
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminModerationPage = lazy(() => import('./pages/admin/AdminModerationPage'))
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'))
const AdminConfigPage = lazy(() => import('./pages/admin/AdminConfigPage'))
const AdminBlogPage = lazy(() => import('./pages/admin/AdminBlogPage'))
const AdminTemplatesPage = lazy(() => import('./pages/admin/AdminTemplatesPage'))
const AdminNotificationsPage = lazy(() => import('./pages/admin/AdminNotificationsPage'))

export default function App() {
  const [globalError, setGlobalError] = useState<string | null>(null)

  useEffect(() => {
    const handleUnhandledError = (event: ErrorEvent) => {
      logError('UnhandledError', event.error ?? event.message)
      setGlobalError(getErrorMessage(event.error ?? event.message, 'The app hit an unexpected error.'))
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logError('UnhandledRejection', event.reason)
      setGlobalError(getErrorMessage(event.reason, 'A background action failed. Please try again.'))
    }

    window.addEventListener('error', handleUnhandledError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => {
      window.removeEventListener('error', handleUnhandledError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  return (
    <ErrorBoundary>
      <div className={styles.app}>
        <Suspense fallback={<div className={styles.routeLoading}>Loading...</div>}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<ProtectedRoute pageName="the Dashboard"><DashboardPage /></ProtectedRoute>} />
            <Route path="/projects/:projectId" element={<ProtectedRoute pageName="your project"><ProjectBuilderPage /></ProtectedRoute>} />
            <Route path="/templates" element={<ProtectedRoute pageName="Templates"><TemplatesPage /></ProtectedRoute>} />
            <Route path="/providers" element={<ProtectedRoute pageName="Providers"><ProvidersPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute pageName="Profile"><ProfilePage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute pageName="Settings"><SettingsPage /></ProtectedRoute>} />
            <Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
              <Route index element={<AdminModerationPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="config" element={<AdminConfigPage />} />
              <Route path="notification" element={<AdminNotificationsPage />} />
              <Route path="blog" element={<AdminBlogPage />} />
              <Route path="templates" element={<AdminTemplatesPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
        {globalError && (
          <div className={styles.globalError} role="alert">
            <span>{globalError}</span>
            <button type="button" onClick={() => setGlobalError(null)} aria-label="Dismiss error">
              Dismiss
            </button>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}
