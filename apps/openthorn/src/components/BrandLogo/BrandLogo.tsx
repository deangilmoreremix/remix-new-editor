import { BRAND_NAME } from '../../lib/brand'

interface BrandLogoProps {
  className?: string
  /** Decorative marks (next to visible text) should not be announced. */
  decorative?: boolean
}

/**
 * Inline brand mark for the embedded Smart Website Builder. Replaces the
 * upstream /assets/logo.png, which does not resolve under the /openthorn/
 * mount (the absolute path escapes the sub-app base).
 */
export default function BrandLogo({ className, decorative = false }: BrandLogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#d9ff00"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : BRAND_NAME}
      style={{ aspectRatio: '1 / 1' }}
    >
      <rect x="2.5" y="3.5" width="19" height="17" rx="3" />
      <line x1="2.5" y1="8.5" x2="21.5" y2="8.5" />
      <circle cx="6" cy="6" r="0.6" fill="#d9ff00" />
      <circle cx="8.5" cy="6" r="0.6" fill="#d9ff00" />
      <path d="M8 16l2.5-4 2 3 1.5-2 2 3" />
    </svg>
  )
}
