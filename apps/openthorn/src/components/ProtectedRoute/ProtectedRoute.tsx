import { useAuth } from '../../lib/AuthContext'
import { BRAND_NAME } from '../../lib/brand'
import BrandLogo from '../BrandLogo/BrandLogo'
import styles from './ProtectedRoute.module.css'

interface ProtectedRouteProps {
  children: React.ReactNode
  pageName?: string
}

/** Navigate the SmartVideo page that embeds the builder (falls back to this window). */
function openInApp(path: string) {
  try {
    window.top!.location.href = path
  } catch {
    window.location.href = path
  }
}

/**
 * Access is tied to the SmartVideo account: anyone signed in to SmartVideo,
 * paid or not, is signed in here automatically (see AuthContext SSO).
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, ssoStatus, ssoError, retrySso } = useAuth()

  if (ssoStatus === 'ready' && user) return <>{children}</>

  let heading = 'Connecting your SmartVideo account…'
  let subtext: string | null = null
  let actions: React.ReactNode = null

  if (ssoStatus === 'signed_out') {
    heading = 'Sign in to SmartVideo'
    subtext = `${BRAND_NAME} uses your SmartVideo account. Sign in to start building.`
    actions = (
      <button className={styles.btnPrimary} onClick={() => openInApp('/signin')} type="button">
        Sign in
      </button>
    )
  } else if (ssoStatus === 'error') {
    heading = 'Could not connect your account'
    subtext = ssoError ?? 'Please try again.'
    actions = (
      <button className={styles.btnPrimary} onClick={retrySso} type="button">
        Try again
      </button>
    )
  }

  return (
    <div className={styles.gate}>
      <div className={styles.card} aria-live="polite">
        <div className={styles.logo}>
          <BrandLogo className={styles.logoImg} decorative />
        </div>
        <h1 className={styles.heading}>{heading}</h1>
        {subtext && <p className={styles.subtext}>{subtext}</p>}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </div>
  )
}
