import { useState, useEffect, lazy, Suspense, Component, type ReactNode, type ErrorInfo } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { usePageTitle } from './lib/usePageTitle'
import { useJsonLd } from './lib/useJsonLd'
import { getErrorMessage, logError } from './lib/errors'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary'
import Header from './components/Header/Header'
import HeroSection from './components/HeroSection/HeroSection'
import BYOKSection from './components/BYOKSection/BYOKSection'
import BottomCTA from './components/BottomCTA/BottomCTA'
import Footer from './components/Footer/Footer'
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute'
import AdminGuard from './components/AdminGuard/AdminGuard'
import StudioWrapper from './components/StudioWrapper'
import AnnouncementBanner from './components/AnnouncementBanner/AnnouncementBanner'
import styles from './App.module.css'

// Lightweight error boundary for individual routes — prevents one studio crash
// from bringing down the entire app
class RouteErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[RouteErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.routeError} role="alert">
          <p>This section encountered an error.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className={styles.routeErrorButton}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// Route pages are code-split so the heavy builder/preview stack (esbuild-wasm,
// jszip, html2canvas, the agent) isn't pulled into the initial landing bundle.
const PricingPage = lazy(() => import('./pages/PricingPage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const CookiesPage = lazy(() => import('./pages/CookiesPage'))
const ImprintPage = lazy(() => import('./pages/ImprintPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ProjectBuilderPage = lazy(() => import('./pages/ProjectBuilderPage'))
const ProvidersPage = lazy(() => import('./pages/ProvidersPage'))
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'))
const CommunityPage = lazy(() => import('./pages/CommunityPage'))
const BlogPage = lazy(() => import('./pages/BlogPage'))
const BlogPostPage = lazy(() => import('./pages/BlogPostPage'))
const FaqPage = lazy(() => import('./pages/FaqPage'))
const ChangelogPage = lazy(() => import('./pages/ChangelogPage'))
const CompareIndexPage = lazy(() => import('./pages/CompareIndexPage'))
const ComparePage = lazy(() => import('./pages/ComparePage'))
const BuildWithIndexPage = lazy(() => import('./pages/BuildWithIndexPage'))
const BuildWithPage = lazy(() => import('./pages/BuildWithPage'))
const GlossaryPage = lazy(() => import('./pages/GlossaryPage'))
const ModerationPage = lazy(() => import('./pages/ModerationPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminModerationPage = lazy(() => import('./pages/admin/AdminModerationPage'))
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'))
const AdminConfigPage = lazy(() => import('./pages/admin/AdminConfigPage'))
const AdminBlogPage = lazy(() => import('./pages/admin/AdminBlogPage'))
const AdminTemplatesPage = lazy(() => import('./pages/admin/AdminTemplatesPage'))
const AdminNotificationsPage = lazy(() => import('./pages/admin/AdminNotificationsPage'))

function HomePage() {
  usePageTitle()
  useJsonLd({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'SmartVideo',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    description:
      'SmartVideo is the BYOK AI website builder — describe what you want, get a complete, deployable website. No subscription, no lock-in.',
    url: 'https://www.smartvid.app',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free to use — bring your own API keys',
    },
  })

  return (
    <>
      <HeroSection />
      <BYOKSection />
      <BottomCTA />
    </>
  )
}

function ScrollToTop() {
  const { pathname, search } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 })
  }, [pathname, search])

  return null
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ScrollToTop />
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  )
}

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
        <AnnouncementBanner />
        <Suspense fallback={<div className={styles.routeLoading}>Loading...</div>}>
          <Routes>
            <Route path="/" element={<Layout><HomePage /></Layout>} />
            <Route path="/pricing" element={<Layout><PricingPage /></Layout>} />
            <Route path="/privacy" element={<Layout><PrivacyPage /></Layout>} />
            <Route path="/terms" element={<Layout><TermsPage /></Layout>} />
            <Route path="/cookies" element={<Layout><CookiesPage /></Layout>} />
            <Route path="/imprint" element={<Layout><ImprintPage /></Layout>} />
            <Route path="/moderation" element={<Layout><ModerationPage /></Layout>} />
            <Route path="/blog" element={<Layout><BlogPage /></Layout>} />
            <Route path="/blog/:slug" element={<Layout><BlogPostPage /></Layout>} />
            <Route path="/faq" element={<Layout><FaqPage /></Layout>} />
            <Route path="/changelog" element={<Layout><ChangelogPage /></Layout>} />
            <Route path="/compare" element={<Layout><CompareIndexPage /></Layout>} />
            <Route path="/compare/:slug" element={<Layout><ComparePage /></Layout>} />
            <Route path="/build-with" element={<Layout><BuildWithIndexPage /></Layout>} />
            <Route path="/build-with/:slug" element={<Layout><BuildWithPage /></Layout>} />
            <Route path="/glossary" element={<Layout><GlossaryPage /></Layout>} />
            <Route path="/dashboard" element={<ProtectedRoute pageName="the Dashboard"><DashboardPage /></ProtectedRoute>} />
            <Route path="/projects/:projectId" element={<ProtectedRoute pageName="your project"><ProjectBuilderPage /></ProtectedRoute>} />
            <Route path="/templates" element={<ProtectedRoute pageName="Templates"><TemplatesPage /></ProtectedRoute>} />
            <Route path="/community" element={<ProtectedRoute pageName="Community"><CommunityPage /></ProtectedRoute>} />
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
            <Route path="/image" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="image" /></RouteErrorBoundary></Layout>} />
            <Route path="/video" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="video" /></RouteErrorBoundary></Layout>} />
            <Route path="/cinema" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="cinema" /></RouteErrorBoundary></Layout>} />
            <Route path="/character" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="character" /></RouteErrorBoundary></Layout>} />
            <Route path="/effects" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="effects" /></RouteErrorBoundary></Layout>} />
            <Route path="/edit" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="edit" /></RouteErrorBoundary></Layout>} />
            <Route path="/upscale" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="upscale" /></RouteErrorBoundary></Layout>} />
            <Route path="/audio" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="audio" /></RouteErrorBoundary></Layout>} />
            <Route path="/avatar" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="avatar" /></RouteErrorBoundary></Layout>} />
            <Route path="/influencer" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="influencer" /></RouteErrorBoundary></Layout>} />
            <Route path="/commercial" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="commercial" /></RouteErrorBoundary></Layout>} />
            <Route path="/storyboard" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="storyboard" /></RouteErrorBoundary></Layout>} />
            <Route path="/training" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="training" /></RouteErrorBoundary></Layout>} />
            <Route path="/videotools" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="videotools" /></RouteErrorBoundary></Layout>} />
            <Route path="/chat" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="chat" /></RouteErrorBoundary></Layout>} />
            <Route path="/lipsync" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="lipsync" /></RouteErrorBoundary></Layout>} />
            <Route path="/apps" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="apps" /></RouteErrorBoundary></Layout>} />
            <Route path="/explore" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="explore" /></RouteErrorBoundary></Layout>} />
            <Route path="/render" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="render" /></RouteErrorBoundary></Layout>} />
            <Route path="/video-agent" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="video-agent" /></RouteErrorBoundary></Layout>} />
            <Route path="/director" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="director" /></RouteErrorBoundary></Layout>} />
            <Route path="/timeline" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="timeline" /></RouteErrorBoundary></Layout>} />
            <Route path="/ai-vfx" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="ai-vfx" /></RouteErrorBoundary></Layout>} />
            <Route path="/assist" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="assist" /></RouteErrorBoundary></Layout>} />
            <Route path="/text-to-image" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="text-to-image" /></RouteErrorBoundary></Layout>} />
            <Route path="/image-to-image" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="image-to-image" /></RouteErrorBoundary></Layout>} />
            <Route path="/text-to-video" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="text-to-video" /></RouteErrorBoundary></Layout>} />
            <Route path="/image-to-video" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="image-to-video" /></RouteErrorBoundary></Layout>} />
            <Route path="/video-to-video" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="video-to-video" /></RouteErrorBoundary></Layout>} />
            <Route path="/video-watermark" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="video-watermark" /></RouteErrorBoundary></Layout>} />
            <Route path="/storyboard-page" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="storyboard-page" /></RouteErrorBoundary></Layout>} />
            <Route path="/character-page" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="character-page" /></RouteErrorBoundary></Layout>} />
            <Route path="/effects-page" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="effects-page" /></RouteErrorBoundary></Layout>} />
            <Route path="/cinema-page" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="cinema-page" /></RouteErrorBoundary></Layout>} />
            <Route path="/influencer-page" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="influencer-page" /></RouteErrorBoundary></Layout>} />
            <Route path="/commercial-page" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="commercial-page" /></RouteErrorBoundary></Layout>} />
            <Route path="/upscale-page" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="upscale-page" /></RouteErrorBoundary></Layout>} />
            <Route path="/openthorn" element={<Layout><RouteErrorBoundary><StudioWrapper studioPath="openthorn" /></RouteErrorBoundary></Layout>} />
            <Route path="*" element={<NotFoundPage />} />
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
      <Analytics />
      <SpeedInsights />
    </ErrorBoundary>
  )
}
