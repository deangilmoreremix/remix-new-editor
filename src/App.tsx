import { useState, useEffect, lazy, Suspense } from 'react'
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
import AuthModal from './components/AuthModal/AuthModal'
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute'
import AdminGuard from './components/AdminGuard/AdminGuard'
import StudioWrapper from './components/StudioWrapper'
import AnnouncementBanner from './components/AnnouncementBanner/AnnouncementBanner'
import styles from './App.module.css'

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
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin')

  const openSignIn = () => { setAuthModalMode('signin'); setAuthModalOpen(true) }
  const openSignUp = () => { setAuthModalMode('signup'); setAuthModalOpen(true) }

  useEffect(() => {
    const handleRequireAuth = (e: Event) => {
      const mode = (e as CustomEvent<{ mode?: 'signin' | 'signup' }>).detail?.mode
      if (mode === 'signup') openSignUp()
      else openSignIn()
    }
    window.addEventListener('smartvid:require-auth', handleRequireAuth)
    return () => window.removeEventListener('smartvid:require-auth', handleRequireAuth)
  }, [])

  return (
    <>
      <ScrollToTop />
      <Header onSignIn={openSignIn} onSignUp={openSignUp} />
      <main>{children}</main>
      <Footer />
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />
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
            <Route path="/image" element={<Layout><StudioWrapper studioPath="image" /></Layout>} />
            <Route path="/video" element={<Layout><StudioWrapper studioPath="video" /></Layout>} />
            <Route path="/cinema" element={<Layout><StudioWrapper studioPath="cinema" /></Layout>} />
            <Route path="/character" element={<Layout><StudioWrapper studioPath="character" /></Layout>} />
            <Route path="/effects" element={<Layout><StudioWrapper studioPath="effects" /></Layout>} />
            <Route path="/edit" element={<Layout><StudioWrapper studioPath="edit" /></Layout>} />
            <Route path="/upscale" element={<Layout><StudioWrapper studioPath="upscale" /></Layout>} />
            <Route path="/audio" element={<Layout><StudioWrapper studioPath="audio" /></Layout>} />
            <Route path="/avatar" element={<Layout><StudioWrapper studioPath="avatar" /></Layout>} />
            <Route path="/influencer" element={<Layout><StudioWrapper studioPath="influencer" /></Layout>} />
            <Route path="/commercial" element={<Layout><StudioWrapper studioPath="commercial" /></Layout>} />
            <Route path="/storyboard" element={<Layout><StudioWrapper studioPath="storyboard" /></Layout>} />
            <Route path="/training" element={<Layout><StudioWrapper studioPath="training" /></Layout>} />
            <Route path="/videotools" element={<Layout><StudioWrapper studioPath="videotools" /></Layout>} />
            <Route path="/chat" element={<Layout><StudioWrapper studioPath="chat" /></Layout>} />
            <Route path="/lipsync" element={<Layout><StudioWrapper studioPath="lipsync" /></Layout>} />
            <Route path="/apps" element={<Layout><StudioWrapper studioPath="apps" /></Layout>} />
            <Route path="/explore" element={<Layout><StudioWrapper studioPath="explore" /></Layout>} />
            <Route path="/render" element={<Layout><StudioWrapper studioPath="render" /></Layout>} />
            <Route path="/video-agent" element={<Layout><StudioWrapper studioPath="video-agent" /></Layout>} />
            <Route path="/director" element={<Layout><StudioWrapper studioPath="director" /></Layout>} />
            <Route path="/timeline" element={<Layout><StudioWrapper studioPath="timeline" /></Layout>} />
            <Route path="/ai-vfx" element={<Layout><StudioWrapper studioPath="ai-vfx" /></Layout>} />
            <Route path="/assist" element={<Layout><StudioWrapper studioPath="assist" /></Layout>} />
            <Route path="/text-to-image" element={<Layout><StudioWrapper studioPath="text-to-image" /></Layout>} />
            <Route path="/image-to-image" element={<Layout><StudioWrapper studioPath="image-to-image" /></Layout>} />
            <Route path="/text-to-video" element={<Layout><StudioWrapper studioPath="text-to-video" /></Layout>} />
            <Route path="/image-to-video" element={<Layout><StudioWrapper studioPath="image-to-video" /></Layout>} />
            <Route path="/video-to-video" element={<Layout><StudioWrapper studioPath="video-to-video" /></Layout>} />
            <Route path="/video-watermark" element={<Layout><StudioWrapper studioPath="video-watermark" /></Layout>} />
            <Route path="/storyboard-page" element={<Layout><StudioWrapper studioPath="storyboard-page" /></Layout>} />
            <Route path="/character-page" element={<Layout><StudioWrapper studioPath="character-page" /></Layout>} />
            <Route path="/effects-page" element={<Layout><StudioWrapper studioPath="effects-page" /></Layout>} />
            <Route path="/cinema-page" element={<Layout><StudioWrapper studioPath="cinema-page" /></Layout>} />
            <Route path="/influencer-page" element={<Layout><StudioWrapper studioPath="influencer-page" /></Layout>} />
            <Route path="/commercial-page" element={<Layout><StudioWrapper studioPath="commercial-page" /></Layout>} />
            <Route path="/upscale-page" element={<Layout><StudioWrapper studioPath="upscale-page" /></Layout>} />
            <Route path="/openthorn" element={<Layout><StudioWrapper studioPath="openthorn" /></Layout>} />
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
