import React from 'react'

export type SocialNetwork = 'facebook' | 'instagram' | 'linkedin' | 'youtube' | 'tiktok'
export type SocialLinks = Partial<Record<SocialNetwork, string | undefined>>

const ORDER: SocialNetwork[] = ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok']
const LABEL: Record<SocialNetwork, string> = { facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', youtube: 'YouTube', tiktok: 'TikTok' }
const HOST: Record<SocialNetwork, RegExp> = {
  facebook: /(^|\.)facebook\.com$|(^|\.)fb\.com$/, instagram: /(^|\.)instagram\.com$/, linkedin: /(^|\.)linkedin\.com$/,
  youtube: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/, tiktok: /(^|\.)tiktok\.com$/,
}
const BASE: Record<SocialNetwork, string> = {
  facebook: 'https://www.facebook.com/', instagram: 'https://www.instagram.com/', linkedin: 'https://www.linkedin.com/company/',
  youtube: 'https://www.youtube.com/@', tiktok: 'https://www.tiktok.com/@',
}
const SHARE = /\/(sharer|share|intent|dialog|plugins|login|signup)(\/|\.php|$)/i

/** Profile URL for a stored value (full URL on the right host, or a plain handle), else null. Never links to share/login URLs. */
export function socialHref(network: SocialNetwork, raw: string | undefined): string | null {
  const v = (raw ?? '').trim()
  if (!v) return null
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v)
      if (!HOST[network].test(u.hostname.toLowerCase()) || SHARE.test(u.pathname) || u.pathname.replace(/\//g, '') === '') return null
      return u.toString()
    } catch { return null }
  }
  const handle = v.replace(/^@/, '')
  return /^[A-Za-z0-9._-]{2,60}$/.test(handle) ? BASE[network] + handle : null
}

const PATHS: Record<SocialNetwork, string> = {
  facebook: 'M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z',
  instagram: 'M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 4 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zM12 0C8.7 0 8.3 0 7.1.1 2.7.3.3 2.7.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.2 4.4 2.6 6.8 7 7C8.3 24 8.7 24 12 24s3.7 0 4.9-.1c4.4-.2 6.8-2.6 7-7 .1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c-.2-4.4-2.6-6.8-7-7C15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.8a1.4 1.4 0 1 0 0 2.9 1.4 1.4 0 0 0 0-2.9z',
  linkedin: 'M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.4V9h3.4v1.6c.5-.9 1.6-1.8 3.4-1.8 3.6 0 4.3 2.4 4.3 5.5v6.2zM5.3 7.4a2.1 2.1 0 1 1 0-4.1 2.1 2.1 0 0 1 0 4.1zM7.1 20.5H3.6V9h3.6v11.5zM22.2 0H1.8C.8 0 0 .8 0 1.7v20.6c0 .9.8 1.7 1.8 1.7h20.4c1 0 1.8-.8 1.8-1.7V1.7C24 .8 23.2 0 22.2 0z',
  youtube: 'M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.500 0-9.400.5A3 3 0 0 0 .5 6.200C0 8.100 0 12 0 12s0 3.900.5 5.800a3 3 0 0 0 2.100 2.100c1.900.5 9.400.5 9.400.5s7.500 0 9.400-.5a3 3 0 0 0 2.100-2.100c.5-1.900.5-5.800.5-5.800s0-3.900-.5-5.800zM9.600 15.600V8.400l6.200 3.600-6.200 3.600z',
  tiktok: 'M12.5 0h3.400c.2 1.800 1.200 3.500 2.700 4.600 1 .7 2.100 1.100 3.400 1.200v3.500c-1.600 0-3.100-.5-4.400-1.300v7.500c0 3.800-3 6.800-6.800 6.800S4 19.300 4 15.500s3-6.800 6.800-6.800c.4 0 .7 0 1.100.1v3.600a3.300 3.300 0 1 0 .6 6.400c1.800-.2 1.700-1.400 1.700-3.200L12.500 0z',
}

const BRAND: Record<SocialNetwork, string> = {
  facebook: '#1877F2', instagram: 'url(#', linkedin: '#0A66C2', youtube: '#FF0000', tiktok: '#FFFFFF',
}

export interface SocialIconsProps {
  links: SocialLinks
  /** Glyph size in px. Default 14: small enough to sit beside the 9px uppercase chips. */
  size?: number
  /** Business name, used in the accessible label ("Instagram page for Joe's"). */
  name?: string
  /** Optional hover text per network (e.g. where the profile was found). */
  titles?: Partial<Record<SocialNetwork, string>>
  /** When given, each icon gets a small × beside it that calls this with the network (to remove a found value). */
  onRemove?: (network: SocialNetwork) => void
}

export function SocialIcons({ links, size = 14, name, titles, onRemove }: SocialIconsProps) {
  const items = ORDER.map((n) => ({ n, href: socialHref(n, links[n]) })).filter((x): x is { n: SocialNetwork; href: string } => !!x.href)
  const gid = `ig-grad-${React.useId().replace(/[^a-zA-Z0-9_-]/g, '')}` // stable across server and client render
  if (!items.length) return null
  return (
    <span data-testid="social-icons" style={{ display: 'inline-flex', alignItems: 'center', gap: onRemove ? 8 : 4 }}>
      {items.map(({ n, href }) => {
        const fill = n === 'instagram' ? `url(#${gid})` : BRAND[n]
        return (
          <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
          <a
            href={href} target="_blank" rel="noopener noreferrer"
            aria-label={name ? `${LABEL[n]} page for ${name}` : `${LABEL[n]} page`} title={titles?.[n] ? `${LABEL[n]} page — ${titles[n]}` : `${LABEL[n]} page`}
            data-network={n} onClick={(e) => e.stopPropagation()}
            style={{ display: 'inline-flex', width: size, height: size, alignItems: 'center', justifyContent: 'center', lineHeight: 0 }}
          >
            <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
              {n === 'instagram' && (
                <defs>
                  <linearGradient id={gid} x1="0" y1="1" x2="1" y2="0">
                    <stop offset="0" stopColor="#FEDA75" /><stop offset="0.28" stopColor="#FA7E1E" /><stop offset="0.5" stopColor="#D62976" />
                    <stop offset="0.75" stopColor="#962FBF" /><stop offset="1" stopColor="#4F5BD5" />
                  </linearGradient>
                </defs>
              )}
              {n === 'tiktok' && (
                <>
                  <path d={PATHS[n]} fill="#25F4EE" transform="translate(-0.9 -0.9)" />
                  <path d={PATHS[n]} fill="#FE2C55" transform="translate(0.9 0.9)" />
                </>
              )}
              <path d={PATHS[n]} fill={fill} transform={n === 'linkedin' ? 'translate(2.4 2.4) scale(0.8)' : undefined} />
            </svg>
          </a>
          {onRemove && (
            <button
              type="button" aria-label={`Remove ${LABEL[n]}`} onClick={(e) => { e.stopPropagation(); onRemove(n) }}
              style={{ background: 'transparent', border: 0, padding: 0, color: 'inherit', opacity: 0.55, cursor: 'pointer', fontSize: 11, lineHeight: 1 }}
            >×</button>
          )}
          </span>
        )
      })}
    </span>
  )
}
