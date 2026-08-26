import { Link } from 'react-router-dom'
import styles from './Footer.module.css'

const solutionsLinks = [
   { label: 'Founders', href: '/blog/introducing-smartvideo' },
   { label: 'Developers', href: '/faq' },
   { label: 'Product Managers', href: '/templates' },
   { label: 'Designers', href: '/templates' },
   { label: 'Marketers', href: '/templates' },
   { label: 'Agencies', href: '/templates' },
   { label: 'Ops', href: '/faq' },
]

const useCasesLinks = [
  { label: 'Productivity', href: '/templates' },
  { label: 'E-Commerce', href: '/templates' },
  { label: 'Marketing & Sales', href: '/templates' },
  { label: 'SaaS & Startups', href: '/templates' },
  { label: 'Education', href: '/templates' },
  { label: 'Community platforms', href: '/community' },
]

const resourcesLinks = [
  { label: 'Blog', href: '/blog' },
  { label: 'Changelog', href: '/changelog' },
  { label: 'Templates', href: '/templates' },
]

const resourcesRouteLinks = [
  { label: 'Docs & FAQs', to: '/faq' },
  { label: 'Comparisons', to: '/compare' },
  { label: 'Provider Guides', to: '/build-with' },
  { label: 'Glossary', to: '/glossary' },
]

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.top}>
          {/* Brand */}
          <div className={styles.brand}>
            <a href="/" className={styles.logo}>
              <img src="/assets/logo.png" alt="" className={styles.logoImg} />
              <span className={styles.logoText}>Smart Video</span>
            </a>
            <p className={styles.tagline}>
              Turn a description into a deployed website â€” with your own API keys and your
              own infrastructure.
            </p>
          </div>

          {/* Solutions */}
          <div>
            <div className={styles.colTitle}>Solutions</div>
            <div className={styles.colLinks}>
              {solutionsLinks.map((l) => (
                <a key={l.label} href={l.href}>{l.label}</a>
              ))}
            </div>
          </div>

          {/* Use Cases */}
          <div>
            <div className={styles.colTitle}>Use Cases</div>
            <div className={styles.colLinks}>
              {useCasesLinks.map((l) => (
                <a key={l.label} href={l.href}>{l.label}</a>
              ))}
            </div>
          </div>

          {/* Resources */}
          <div>
            <div className={styles.colTitle}>Resources</div>
            <div className={styles.colLinks}>
              {resourcesLinks.map((l) => (
                <a key={l.label} href={l.href}>{l.label}</a>
              ))}
              {resourcesRouteLinks.map((l) => (
                <Link key={l.label} to={l.to}>{l.label}</Link>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.bottom}>
          <span className={styles.copyright}>
            &copy; {new Date().getFullYear()} Smart Video. All rights reserved.
          </span>
          <div className={styles.socials}>
            <a href="https://x.com" aria-label="X" target="_blank" rel="noopener noreferrer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
