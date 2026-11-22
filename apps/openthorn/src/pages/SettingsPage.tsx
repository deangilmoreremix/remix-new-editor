import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { usePageTitle } from '../lib/usePageTitle'
import styles from './SettingsPage.module.css'
import BrandLogo from '../components/BrandLogo/BrandLogo'
import { T, RPC } from '../lib/tables'
import { getCloudflareStatus, connectCloudflare, disconnectCloudflare, type CloudflareStatus } from '../lib/cloudflare-connection'

type Tab = 'account' | 'providers' | 'hosting' | 'knowledge' | 'danger'

const MAX_INSTRUCTIONS = 2000

function CheckIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

const navItems: { id: Tab; label: string; danger?: boolean; icon: React.ReactNode }[] = [
  {
    id: 'account', label: 'Account',
    icon: <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  },
  {
    id: 'providers', label: 'Providers',
    icon: <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
  },
  {
    id: 'hosting', label: 'Hosting',
    icon: <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>,
  },
  {
    id: 'knowledge', label: 'Knowledge',
    icon: <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  },
  {
    id: 'danger', label: 'Danger Zone', danger: true,
    icon: <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  },
]

export default function SettingsPage() {
  usePageTitle('Settings', {
    description: 'Manage your Smart Website Builder account, provider settings, custom instructions, and account safety options.',
  })
  const { user } = useAuth()
  const navigate = useNavigate()

  const [searchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const [tab, setTab] = useState<Tab>(
    navItems.some((n) => n.id === requestedTab) ? (requestedTab as Tab) : 'account',
  )

  const [cf, setCf] = useState<CloudflareStatus | null>(null)
  const [cfLoadError, setCfLoadError] = useState('')
  const [cfAccountId, setCfAccountId] = useState('')
  const [cfToken, setCfToken] = useState('')
  const [cfBusy, setCfBusy] = useState(false)
  const [cfError, setCfError] = useState('')

  useEffect(() => {
    if (tab !== 'hosting' || !user) return
    let cancelled = false
    getCloudflareStatus()
      .then((status) => { if (!cancelled) { setCf(status); setCfLoadError('') } })
      .catch((err) => { if (!cancelled) setCfLoadError(err instanceof Error ? err.message : 'Could not load hosting status.') })
    return () => { cancelled = true }
  }, [tab, user])

  async function handleCfConnect() {
    setCfBusy(true)
    setCfError('')
    try {
      setCf(await connectCloudflare(cfAccountId, cfToken))
      setCfToken('')
      setCfAccountId('')
    } catch (err) {
      setCfError(err instanceof Error ? err.message : 'Could not connect Cloudflare.')
    } finally {
      setCfBusy(false)
    }
  }

  async function handleCfDisconnect() {
    setCfBusy(true)
    setCfError('')
    try {
      setCf(await disconnectCloudflare())
    } catch (err) {
      setCfError(err instanceof Error ? err.message : 'Could not disconnect Cloudflare.')
    } finally {
      setCfBusy(false)
    }
  }

  // Email


  // Knowledge
  const [instructions, setInstructions] = useState('')
  const [instructionsSaved, setInstructionsSaved] = useState('')
  const [knowledgeLoading, setKnowledgeLoading] = useState(true)
  const [knowledgeSaving, setKnowledgeSaving] = useState(false)
  const [knowledgeSuccess, setKnowledgeSuccess] = useState(false)
  const [knowledgeError, setKnowledgeError] = useState('')

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    if (!user) return
    supabase
      .from(T.profiles)
      .select('custom_instructions')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        const val = (data as { custom_instructions: string | null })?.custom_instructions ?? ''
        setInstructions(val)
        setInstructionsSaved(val)
        setKnowledgeLoading(false)
      })
  }, [user])

  const handleKnowledgeSave = async () => {
    if (!user) return
    setKnowledgeSaving(true); setKnowledgeError(''); setKnowledgeSuccess(false)
    const { error } = await supabase
      .from(T.profiles)
      .update({ custom_instructions: instructions.trim() || null })
      .eq('id', user.id)
    setKnowledgeSaving(false)
    if (error) { setKnowledgeError(error.message); return }
    setInstructionsSaved(instructions)
    setKnowledgeSuccess(true)
    setTimeout(() => setKnowledgeSuccess(false), 3000)
  }

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (deleteConfirm !== 'delete my builder data') { setDeleteError('Type the confirmation phrase exactly.'); return }
    setDeleteLoading(true); setDeleteError('')
    const { error } = await supabase.rpc(RPC.delete_user)
    if (error) { setDeleteError(error.message); setDeleteLoading(false); return }
    // Builder data is gone; the SmartVideo account itself is untouched, so
    // reload to start again with an empty builder.
    window.location.assign(`${import.meta.env.BASE_URL}dashboard`)
  }

  if (!user) return null

  const isDirty = instructions !== instructionsSaved
  const charsLeft = MAX_INSTRUCTIONS - instructions.length

  return (
    <div className={styles.root}>

      {/* ── Settings sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.logoRow}>
          <Link to="/dashboard" className={styles.logo}>
            <BrandLogo className={styles.logoImg} />
          </Link>
        </div>

        <nav className={styles.nav}>
          <div className={styles.navGroup}>
            <div className={styles.sectionLabel}>Settings</div>
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`${styles.navItem} ${tab === item.id ? styles.navItemActive : ''} ${item.danger ? styles.navItemDanger : ''}`}
                onClick={() => setTab(item.id)}
                type="button"
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className={styles.sidebarFooter}>
          <button className={styles.backBtn} onClick={() => navigate('/dashboard')} type="button">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back to Dashboard
          </button>
        </div>
      </aside>

      {/* ── Mobile tab strip ── */}
      <div className={styles.mobileTabBar}>
        <button
          className={styles.mobileBackBtn}
          onClick={() => navigate('/dashboard')}
          type="button"
          aria-label="Back to Dashboard"
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`${styles.mobileTab} ${tab === item.id ? styles.mobileTabActive : ''} ${item.danger ? styles.mobileTabDanger : ''}`}
            onClick={() => setTab(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* ── Main content ── */}
      <main className={styles.main}>

        {/* Account */}
        {tab === 'account' && (
          <div className={styles.panel}>
            <header className={styles.panelHeader}>
              <h1 className={styles.panelTitle}>Account</h1>
              <p className={styles.panelSubtitle}>Your Website Builder account is your SmartVideo account</p>
            </header>
            <div className={styles.block}>
              <h2 className={styles.blockTitle}>Signed in as</h2>
              <p className={styles.blockDesc}>{user.email}</p>
              <p className={styles.blockDesc}>
                Change your email address or password from your SmartVideo account settings.
              </p>
            </div>
          </div>
        )}

        {/* Providers */}
        {tab === 'providers' && (
          <div className={styles.panel}>
            <header className={styles.panelHeader}>
              <h1 className={styles.panelTitle}>Providers</h1>
              <p className={styles.panelSubtitle}>Manage your AI model API keys and connections</p>
            </header>
            <div className={styles.block}>
              <div className={styles.providerCard}>
                <div className={styles.providerCardIcon}>
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                  </svg>
                </div>
                <div className={styles.providerCardBody}>
                  <h3 className={styles.providerCardTitle}>API Keys & Model Providers</h3>
                  <p className={styles.providerCardDesc}>Connect OpenAI, Anthropic, Google Gemini, DeepSeek, and 13 other providers. Your keys are encrypted and stored securely.</p>
                  <button className={styles.providerCardBtn} onClick={() => navigate('/providers')} type="button">
                    Manage providers
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hosting */}
        {tab === 'hosting' && (
          <div className={styles.panel}>
            <header className={styles.panelHeader}>
              <h1 className={styles.panelTitle}>Hosting</h1>
              <p className={styles.panelSubtitle}>Publish your sites to your own Cloudflare account</p>
            </header>
            <div className={styles.block}>
              <h2 className={styles.blockTitle}>Cloudflare Pages</h2>
              {cfLoadError && <p className={styles.fieldError}>{cfLoadError}</p>}
              {!cf && !cfLoadError && <p className={styles.blockDesc}>Loading…</p>}
              {cf && !cf.configured && (
                <p className={styles.blockDesc}>Publishing isn&apos;t set up on this site yet. Please check back soon.</p>
              )}
              {cf?.configured && cf.connected && (
                <>
                  <div className={styles.successBanner}>
                    <span>Connected · token ending <strong>{cf.tokenLast4}</strong> · account <strong>{cf.accountId}</strong></span>
                  </div>
                  <p className={styles.blockDesc}>Deploy publishes to this account. Your token is stored encrypted and is never shown again.</p>
                  {cfError && <p className={styles.fieldError}>{cfError}</p>}
                  <button className={styles.providerCardBtn} type="button" onClick={handleCfDisconnect} disabled={cfBusy}>
                    {cfBusy ? 'Working…' : 'Disconnect Cloudflare'}
                  </button>
                </>
              )}
              {cf?.configured && !cf.connected && (
                <>
                  <p className={styles.blockDesc}>
                    Sites you build are published to your own free Cloudflare account, so you own them.
                  </p>
                  <ol className={styles.blockDesc}>
                    <li>Sign in at dash.cloudflare.com (a free account works).</li>
                    <li>Copy your <strong>Account ID</strong> from the right-hand side of the dashboard home page.</li>
                    <li>Go to My Profile → API Tokens → Create Token → Create Custom Token, add the permission <strong>Account → Cloudflare Pages → Edit</strong>, and create it.</li>
                    <li>Paste both below.</li>
                  </ol>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="cf-account-id">Account ID</label>
                    <input id="cf-account-id" className={styles.input} value={cfAccountId} onChange={(e) => setCfAccountId(e.target.value)} placeholder="32 characters" autoComplete="off" spellCheck={false} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="cf-token">API token</label>
                    <input id="cf-token" className={styles.input} type="password" value={cfToken} onChange={(e) => setCfToken(e.target.value)} placeholder="Paste your token" autoComplete="off" />
                  </div>
                  {cfError && <p className={styles.fieldError}>{cfError}</p>}
                  <button className={styles.submitBtn} type="button" onClick={handleCfConnect} disabled={cfBusy || !cfAccountId.trim() || !cfToken.trim()}>
                    {cfBusy ? 'Checking with Cloudflare…' : 'Connect Cloudflare'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Knowledge */}
        {tab === 'knowledge' && (
          <div className={styles.panel}>
            <header className={styles.panelHeader}>
              <h1 className={styles.panelTitle}>Knowledge</h1>
              <p className={styles.panelSubtitle}>Custom instructions applied to every project you build</p>
            </header>

            <div className={styles.block}>
              <div className={styles.knowledgeIntro}>
                <div className={styles.knowledgeIntroIcon}>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <p className={styles.knowledgeIntroText}>
                  These instructions are automatically included in every agent run. Use them to set consistent preferences, coding styles, or constraints across all your projects.
                </p>
              </div>

              <div className={styles.exampleChips}>
                {['Always use Tailwind CSS', 'Prefer dark mode by default', 'Use TypeScript strictly', 'Keep components small'].map((ex) => (
                  <button key={ex} className={styles.exampleChip} type="button"
                    onClick={() => {
                      const prefix = instructions.trim() ? instructions.trimEnd() + '\n' : ''
                      if (prefix.length + ex.length <= MAX_INSTRUCTIONS) setInstructions(prefix + ex)
                    }}
                  >+ {ex}</button>
                ))}
              </div>

              {knowledgeLoading ? (
                <div className={styles.knowledgeLoading}><span className={styles.spinner} /></div>
              ) : (
                <>
                  <div className={styles.textareaWrapper}>
                    <textarea
                      className={styles.textarea}
                      value={instructions}
                      onChange={(e) => { if (e.target.value.length <= MAX_INSTRUCTIONS) { setInstructions(e.target.value); setKnowledgeSuccess(false) } }}
                      placeholder={`Examples:\n• Always use TypeScript strict mode\n• Prefer functional components and hooks\n• Use CSS custom properties for theming\n• Keep bundle size minimal`}
                      rows={10}
                      spellCheck={false}
                    />
                    <div className={`${styles.charCount} ${charsLeft < 100 ? styles.charCountWarn : ''}`}>
                      {instructions.length} / {MAX_INSTRUCTIONS}
                    </div>
                  </div>
                  {knowledgeError && <p className={styles.fieldError}>{knowledgeError}</p>}
                  <div className={styles.knowledgeActions}>
                    {knowledgeSuccess && <span className={styles.savedHint}><CheckIcon />Saved</span>}
                    <button className={styles.submitBtn} type="button" onClick={handleKnowledgeSave} disabled={knowledgeSaving || !isDirty}>
                      {knowledgeSaving && <span className={styles.spinner} />}
                      {knowledgeSaving ? 'Saving…' : 'Save instructions'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Danger Zone */}
        {tab === 'danger' && (
          <div className={styles.panel}>
            <header className={styles.panelHeader}>
              <h1 className={`${styles.panelTitle} ${styles.panelTitleDanger}`}>Danger Zone</h1>
              <p className={styles.panelSubtitle}>Irreversible actions — proceed with caution</p>
            </header>

            <div className={`${styles.block} ${styles.blockDanger}`}>
              <h2 className={styles.blockTitle}>Delete Website Builder data</h2>
              <p className={styles.blockDesc}>Permanently deletes your Website Builder projects, saved API keys and community posts. Your SmartVideo account is not affected. This cannot be undone.</p>
              <form className={styles.form} onSubmit={handleDeleteAccount}>
                <div className={styles.deleteWarning}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <span>This action is <strong>permanent and irreversible</strong>. All your data will be deleted immediately.</span>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Type <span className={styles.deletePhrase}>delete my builder data</span> to confirm</label>
                  <input className={`${styles.input} ${deleteError ? styles.inputError : ''}`} type="text" value={deleteConfirm} onChange={(e) => { setDeleteConfirm(e.target.value); setDeleteError('') }} placeholder="delete my builder data" autoComplete="off" />
                  {deleteError && <p className={styles.fieldError}>{deleteError}</p>}
                </div>
                <button className={styles.deleteBtn} type="submit" disabled={deleteLoading || deleteConfirm !== 'delete my builder data'}>
                  {deleteLoading && <span className={styles.spinner} />}
                  {deleteLoading ? 'Deleting…' : 'Permanently delete builder data'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
