/**
 * AdminGuard — previously gated admin routes behind authentication.
 * AUTHENTICATION REMOVED: All routes are now publicly accessible.
 * This component now renders children directly without auth checks.
 */
export default function AdminGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
