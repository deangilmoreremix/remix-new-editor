/**
 * ProtectedRoute — previously gated routes behind authentication.
 * AUTHENTICATION REMOVED: All routes are now publicly accessible.
 * This component now renders children directly without auth checks.
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
