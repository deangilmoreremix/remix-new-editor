import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
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
import AnnouncementBanner from './components/AnnouncementBanner/AnnouncementBanner'
import StudioWrapper from './components/StudioWrapper'
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
    '@type': 'WebApplication',
    name: 'SmartVideo',
    alternateName: 'SmartVideo AI',
    url: 'https://smartvid.app/',
    description:
      'Free, open-source AI image and video generation studio with 20+ models. Create professional images, videos, ads, characters, commercials and social content with AI.',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      'AI Image Generation',
      'AI Video Generation',
      'Cinematic Video Creation',
      'Character Creation',
      'Commercial Video Production',
      'Social Media Content Creation',
      'AI VFX',
      'Lip Sync',
      'Avatar Generation',
      'Video Editing',
    ],
    screenshot: 'https://smartvid.app/thumbnails/heroes/image.webp',
    author: {
      '@type': 'Organization',
      name: 'SmartVideo',
      url: 'https://smartvid.app/',
    },
  })

  return (
    <div className="min-h-screen bg-[#020205] text-white">
      <div className="border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-400 flex items-center justify-center text-black font-black text-sm">S</div>
            <span className="font-bold text-white tracking-tight">SmartVideo</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-white/70">
            <a href="/explore" className="hover:text-white transition">Explore</a>
            <a href="/image" className="hover:text-white transition">Image</a>
            <a href="/video" className="hover:text-white transition">Video</a>
            <a href="/audio" className="hover:text-white transition">Audio</a>
            <a href="/generate" className="hover:text-white transition">Collab</a>
            <a href="/canvas" className="hover:text-white transition">CanvasNew</a>
            <a href="/edit" className="hover:text-white transition">Edit</a>
            <a href="/character" className="hover:text-white transition">Character</a>
            <a href="/marketing-studio" className="hover:text-white transition">Marketing Studio</a>
            <a href="/cinema-studio" className="hover:text-white transition">Cinema Studio</a>
            <a href="/apps" className="hover:text-white transition">Apps</a>
            <a href="/assist" className="hover:text-white transition">Assist</a>
            <a href="/community" className="hover:text-white transition">Community</a>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <a href="/signin" className="text-white/70 hover:text-white transition">Sign In</a>
            <a href="/signup" className="px-4 py-2 bg-cyan-400 text-black font-semibold rounded hover:bg-cyan-300 transition">Get Started</a>
          </div>
        </div>
      </div>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[#020205]"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-32 relative">
          <h1 className="text-5xl md:text-7xl font-black text-white leading-tight mb-6">
            Create Anything. Sell Everything.
          </h1>
          <p className="text-xl text-white/70 max-w-3xl mb-8 leading-relaxed">
            Create professional images, videos, ads, characters, commercials and social content with AI.
          </p>
          <div className="flex items-center gap-3 text-sm text-white/70 mb-10">
            <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5">AI Creative Platform</span>
            <span className="text-white/40">·</span>
            <span>200+ AI Models</span>
            <span className="text-white/40">·</span>
            <span>33 Professional Studios</span>
          </div>
          <div>
            <button className="px-8 py-4 bg-white text-black font-bold text-lg rounded hover:bg-white/90 transition">
              Start creating with SmartVideo today
            </button>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">AI Video Generation Studio</h2>
          <p className="text-white/70 max-w-4xl mb-10 leading-relaxed">
            AI Video Agency Studio gives you a complete creative command center with 60+ AI-powered tools for generating videos, images, characters, commercials, cinematic effects, avatars, lip sync, dubbing, storyboards, edits, workflows, agents, and client-ready content packages — all from one organized platform.
          </p>

          <h3 className="text-xl font-bold text-white mb-4">Platform Features</h3>
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
            <li className="text-white"><strong className="text-white">33</strong> <span className="text-white/70">AI Creative Apps</span></li>
            <li className="text-white"><strong className="text-white">60+</strong> <span className="text-white/70">AI Features</span></li>
            <li className="text-white"><strong className="text-white">200+</strong> <span className="text-white/70">AI Models</span></li>
            <li className="text-white"><strong className="text-white">Lifetime</strong> <span className="text-white/70">Access</span></li>
          </ul>

          <h3 className="text-xl font-bold text-white mb-6">Available Studios</h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <li className="text-white/80"><strong className="text-white">Image</strong> - Generate high-quality AI images for ads, thumbnails, product visuals, social media, websites, and client campaigns.</li>
            <li className="text-white/80"><strong className="text-white">Video</strong> - Create text-to-video, image-to-video, video-to-video, and cinematic motion content for social, ads, and branded campaigns.</li>
            <li className="text-white/80"><strong className="text-white">Cinema Studio</strong> - Direct AI-generated scenes using cinematic camera language, lenses, moods, lighting, motion, shot types, and visual styles.</li>
            <li className="text-white/80"><strong className="text-white">Character</strong> - Create consistent AI characters, branded personas, story characters, spokespersons, creators, and campaign personalities.</li>
            <li className="text-white/80"><strong className="text-white">Influencer</strong> - Create AI influencer visuals, social content concepts, creator-style campaigns, fashion shots, lifestyle scenes, and branded posts.</li>
            <li className="text-white/80"><strong className="text-white">Storyboard</strong> - Plan campaigns, commercials, short films, social videos, and client projects using AI-assisted scene and shot planning.</li>
            <li className="text-white/80"><strong className="text-white">Effects</strong> - Apply creative effects, transformations, motion styles, cinematic treatments, and stylized visual looks.</li>
            <li className="text-white/80"><strong className="text-white">Edit</strong> - Edit, revise, enhance, repurpose, and improve visual assets so users can move from raw AI output to polished delivery.</li>
            <li className="text-white/80"><strong className="text-white">Upscale</strong> - Improve image and video quality with AI upscaling for sharper, cleaner, more professional-looking assets.</li>
            <li className="text-white/80"><strong className="text-white">Audio</strong> - Generate, enhance, transform, or prepare audio assets for videos, voiceovers, ads, explainers, and AI content.</li>
            <li className="text-white/80"><strong className="text-white">Avatar</strong> - Create AI avatar-based content, virtual presenters, branded spokespersons, personality-driven videos, and talking visuals.</li>
            <li className="text-white/80"><strong className="text-white">Commercial</strong> - Create product commercials, brand ads, local business promos, ecommerce videos, launch videos, and agency-ready ad concepts.</li>
            <li className="text-white/80"><strong className="text-white">Templates</strong> - Start faster with prebuilt creative templates for ads, thumbnails, products, social posts, cinematic shots, VFX, and more.</li>
            <li className="text-white/80"><strong className="text-white">Explore</strong> - Browse creative ideas, examples, presets, templates, use cases, visual styles, and production inspiration.</li>
            <li className="text-white/80"><strong className="text-white">Library</strong> - Store, organize, reuse, and manage generated assets, projects, videos, images, templates, and campaign materials.</li>
            <li className="text-white/80"><strong className="text-white">Community</strong> - Showcase examples, discover creative workflows, highlight user creations, and build a community around AI video creation.</li>
          </ul>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/60">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-cyan-400 flex items-center justify-center text-black font-black text-xs">S</div>
            <span className="text-white font-semibold">SmartVideo</span>
          </div>
          <div>Start creating with SmartVideo today — the free, open-source AI video generation studio.</div>
          <div>© SmartVideo</div>
        </div>
      </footer>
    </div>
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
            <Route path="/" element={<HomePage />} />
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
            <Route path="/dashboard" element={<Layout><DashboardPage /></Layout>} />
            <Route path="/website-builder" element={<Layout><StudioWrapper studioPath="smartvideo" /></Layout>} />
            <Route path="/openthorn" element={<Layout><StudioWrapper studioPath="openthorn" /></Layout>} />
            <Route path="/projects/:projectId" element={<Layout><ProjectBuilderPage /></Layout>} />
            <Route path="/templates" element={<Layout><TemplatesPage /></Layout>} />
            <Route path="/community" element={<Layout><CommunityPage /></Layout>} />
            <Route path="/providers" element={<Layout><ProvidersPage /></Layout>} />
            <Route path="/profile" element={<Layout><ProfilePage /></Layout>} />
            <Route path="/settings" element={<Layout><SettingsPage /></Layout>} />
            <Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
              <Route index element={<AdminModerationPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="config" element={<AdminConfigPage />} />
              <Route path="notification" element={<AdminNotificationsPage />} />
              <Route path="blog" element={<AdminBlogPage />} />
              <Route path="templates" element={<AdminTemplatesPage />} />
            </Route>
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
    </ErrorBoundary>
  )
}
