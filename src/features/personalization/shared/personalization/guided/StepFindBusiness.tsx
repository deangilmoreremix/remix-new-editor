'use client'

import { useMemo, useState } from 'react'
import { Building2, Globe, MapPin, Search, Star } from 'lucide-react'
import { useDemoPersonalize } from '../DemoPersonalizeProvider'
import { BUSINESS_NICHES } from '../businessNiches'
import { ownershipBadgeStyle, ownershipLabel } from '../ownershipBadge'
import type { BusinessOwnership, DiscoveredAsset } from '../types'
import { DiscoveredAssetGrid, type DiscoveredAssetDropZone } from '../DiscoveredAssetGrid'
import { ResumeProjectBanner } from '../ResumeProjectBanner'

// Simple mode has no client-asset section cards on screen, so the grid shows
// its own drop zones; dropping an asset imports it into that section.
const SIMPLE_MODE_DROP_ZONES: DiscoveredAssetDropZone[] = [
  { section: 'person', label: 'Person' },
  { section: 'logo', label: 'Logo' },
  { section: 'products', label: 'Products' },
  { section: 'brand', label: 'Brand' },
]
import { C, badgeStyle, hintStyle, inputStyle, labelStyle, panelStyle, primaryButtonStyle, secondaryButtonStyle, softPanelStyle } from './tokens'

const RADIUS_OPTIONS = [5, 15, 50]

function businessLabel(business: {
  name?: string
  category?: string
  city?: string
  region?: string
  phone?: string
  website?: string
}): string {
  return business.name || 'Selected business'
}

/**
 * Simple Mode step 1 — find the customer's business.
 *
 * Three entry paths over the SAME provider functions the full modal uses:
 * search local businesses, enter a website (the single website input in the
 * whole guided flow), or pick a saved business profile.
 */
export function StepFindBusiness({
  onEditAsset,
}: {
  /** Opens the AI image editor on a discovered asset; omitted for anonymous sessions. */
  onEditAsset?: (asset: DiscoveredAsset) => void
} = {}): React.JSX.Element {
  const ctx = useDemoPersonalize()
  const {
    clientForm = {},
    updateClientForm,
    clients = [],
    selectedClientId,
    selectClient,
    saveClient,
    assets,
    businessSearchMode,
    businessSearchResults = [],
    businessSearchError,
    selectedBusiness,
    businessResearch,
    findBusinesses,
    selectBusiness,
    researchBusiness,
    runDiscoveryWorkflow,
    discoverAssets,
    discoveryStatus,
    discoveryError,
    discoveredAssets = [],
    toggleDiscoveredAssetSelection,
    rejectDiscoveredAsset,
    updateDiscoveredAssetCategory,
    revertDiscoveredAssetEdit,
    removeDiscoveredAssetFromSection,
    moveDiscoveredAssetToSection,
    setDiscoveredAssets,
    importDiscoveredAssets,
    importConfirmation,
    access,
    setViewMode,
  } = ctx

  const [searchNiche, setSearchNiche] = useState('')
  const [searchLocation, setSearchLocation] = useState('')
  const [searchRadius, setSearchRadius] = useState(15)
  const [searchFormOpen, setSearchFormOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const searchReady = Boolean(searchNiche && searchLocation.trim())
  const isAnonymous = access !== 'authenticated'

  const businessName = clientForm.businessName || clientForm.name || ''
  const website = clientForm.website || ''
  const research = businessResearch
  const discoveredCount = discoveredAssets.filter((asset) => !asset.rejected).length
  // "Logo found" must reflect the DISCOVERED assets: a discovery run that
  // found logos reports them here, and this step is exactly where the
  // customer is told about them. Reading the asset library instead made the
  // line say "Not yet" right after a discovery that had found a logo.
  const discoveredLogos = discoveredAssets.filter(
    (asset) => !asset.rejected && asset.category === 'logo'
  )
  const logoCount = discoveredLogos.length
  const selectedDiscoveredCount = discoveredAssets.filter(
    (asset) => asset.selected && !asset.rejected
  ).length

  const researchSummary = useMemo(() => {
    if (!research || research.status !== 'done' || !research.result) return null
    const result = research.result
    return {
      title: result.title || '',
      description: result.description || '',
      logoUrl: result.logoUrl || '',
    }
  }, [research])

  const runSearch = async () => {
    if (!searchReady || busy) return
    setBusy(true)
    try {
      await findBusinesses(searchNiche, searchLocation.trim(), searchRadius)
    } finally {
      setBusy(false)
    }
  }

  const handleWebsiteDiscovery = async () => {
    if (!website.trim() || busy) return
    setBusy(true)
    try {
      await runDiscoveryWorkflow(website.trim())
    } catch {
      /* errors surface through discoveryError / businessResearch state */
    } finally {
      setBusy(false)
    }
  }

  const handleFindAssets = async () => {
    if (!website.trim() || busy) return
    setBusy(true)
    try {
      await discoverAssets(website.trim())
    } catch {
      /* errors surface through discoveryError */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ResumeProjectBanner />
      <div>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.text }}>Find your business</h2>
        <p style={{ margin: '4px 0 0', color: C.muted, fontSize: 12, lineHeight: 1.55 }}>
          Search for your business, enter its website, or pick a saved profile. SmartVideo GO AI uses what your
          business already has — logo, photos and details — to brand your video.
        </p>
      </div>

      {/* ── (a) Search local businesses ─────────────────────────────────── */}
      <div style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Search size={15} color={C.cyan} />
          <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: C.text }}>
            Search for a business
          </h3>
        </div>
        {!searchFormOpen ? (
          <button type="button" onClick={() => setSearchFormOpen(true)} style={{ ...secondaryButtonStyle, width: '100%' }}>
            Search by name and location
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 10 }}>
              <div>
                <label style={labelStyle} htmlFor="guided-business-niche">Business type</label>
                <select
                  id="guided-business-niche"
                  value={searchNiche}
                  onChange={(event) => setSearchNiche(event.target.value)}
                  style={inputStyle}
                >
                  <option value="">Choose a type…</option>
                  {BUSINESS_NICHES.map((niche) => (
                    <option key={niche.key} value={niche.key}>{niche.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle} htmlFor="guided-business-location">Location</label>
                <input
                  id="guided-business-location"
                  value={searchLocation}
                  onChange={(event) => setSearchLocation(event.target.value)}
                  placeholder="City or area"
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ ...labelStyle, marginBottom: 0 }}>Search radius</span>
              {RADIUS_OPTIONS.map((radius) => (
                <button
                  key={radius}
                  type="button"
                  onClick={() => setSearchRadius(radius)}
                  aria-pressed={searchRadius === radius}
                  style={{
                    minHeight: 30,
                    padding: '0 12px',
                    borderRadius: 999,
                    border: `1px solid ${searchRadius === radius ? C.cyanBorder : C.border}`,
                    background: searchRadius === radius ? C.cyanSoft : 'transparent',
                    color: searchRadius === radius ? C.cyan : C.muted,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {radius} mi
                </button>
              ))}
              <button
                type="button"
                onClick={runSearch}
                disabled={!searchReady || busy}
                style={{ ...primaryButtonStyle, marginLeft: 'auto', opacity: !searchReady || busy ? 0.5 : 1 }}
              >
                {busy && businessSearchMode === 'searching' ? 'Searching…' : 'Search'}
              </button>
            </div>
          </div>
        )}

        {businessSearchError && (
          <p style={{ margin: '10px 0 0', color: C.danger, fontSize: 11 }}>{businessSearchError}</p>
        )}

        {businessSearchResults.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {businessSearchResults.slice(0, 8).map((business) => {
              const active = selectedBusiness?.id === business.id
              return (
                <div key={business.id} style={{ ...softPanelStyle, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{businessLabel(business)}</div>
                    <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                      {[business.category, [business.city, business.region].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                    </div>
                    {business.phone && <div style={{ color: C.muted2, fontSize: 11 }}>{business.phone}</div>}
                    {business.ownership && (
                      <div style={{ marginTop: 4 }}>
                        <span style={ownershipBadgeStyle(business.ownership)}>
                          {ownershipLabel(business.ownership)}
                        </span>
                      </div>
                    )}                  </div>
                  <button
                    type="button"
                    onClick={() => selectBusiness(business)}
                    style={{
                      ...secondaryButtonStyle,
                      minHeight: 34,
                      border: `1px solid ${active ? C.cyanBorder : C.border}`,
                      color: active ? C.cyan : C.text,
                    }}
                  >
                    {active ? 'Selected' : 'Use this'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── (b) Website — the ONLY website input in the guided flow ─────── */}
      <div style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Globe size={15} color={C.cyan} />
          <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: C.text }}>
            Enter your business website
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto]" style={{ gap: 10, alignItems: 'end' }}>
          <div>
            <label style={labelStyle} htmlFor="guided-business-website">Website</label>
            <input
              id="guided-business-website"
              value={website}
              onChange={(event) => updateClientForm({ ...clientForm, website: event.target.value })}
              placeholder="https://yourbusiness.com"
              style={inputStyle}
            />
          </div>
          {isAnonymous ? (
            <button
              type="button"
              onClick={handleWebsiteDiscovery}
              disabled={!website.trim() || busy}
              style={{ ...primaryButtonStyle, opacity: !website.trim() || busy ? 0.5 : 1 }}
            >
              {busy && discoveryStatus === 'discovering' ? 'Finding…' : 'Find my brand'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFindAssets}
              disabled={!website.trim() || busy}
              style={{ ...primaryButtonStyle, opacity: !website.trim() || busy ? 0.5 : 1 }}
            >
              {busy && discoveryStatus === 'discovering' ? 'Finding…' : 'Find business assets'}
            </button>
          )}
        </div>
        <p style={hintStyle}>
          We read the public page for your logo, photos and business details. Nothing is generated and nothing is charged.
        </p>
        {research && research.status === 'researching' && (
          <p style={{ ...hintStyle, color: C.cyan }}>Reading your website…</p>
        )}
        {research && research.status === 'error' && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: C.danger, fontSize: 11 }}>{research.error || 'We could not read that website.'}</span>
            <button type="button" onClick={() => researchBusiness()} style={{ ...secondaryButtonStyle, minHeight: 30 }}>
              Try again
            </button>
          </div>
        )}
      </div>

      {/* ── (c) Saved business profiles ─────────────────────────────────── */}
      {clients.length > 0 && (
        <div style={panelStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Star size={15} color={C.cyan} />
            <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: C.text }}>
              Saved business profiles
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {clients.slice(0, 6).map((client) => {
              const active = selectedClientId === client.id
              return (
                <div key={client.id} style={{ ...softPanelStyle, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{client.businessName || client.name || 'Saved business'}</div>
                    {(client.industry || client.location) && (
                      <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                        {[client.industry, client.location].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => selectClient(client.id)}
                    style={{
                      ...secondaryButtonStyle,
                      minHeight: 34,
                      border: `1px solid ${active ? C.cyanBorder : C.border}`,
                      color: active ? C.cyan : C.text,
                    }}
                  >
                    {active ? 'Using' : 'Use'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── What we found ───────────────────────────────────────────────── */}
      {/* Shown whenever there is something to report. "Find business assets"
          runs discovery from a typed website alone, with no business name, so
          gating this panel on the name hid the found assets, the progress
          badge and any error: the visitor saw nothing at all. */}
      {(businessName || discoveredAssets.length > 0 || discoveryStatus === 'discovering' || discoveryError) && (
        <div style={{ ...panelStyle, border: `1px solid ${C.cyanBorder}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Building2 size={15} color={C.cyan} />
            <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: C.text }}>
              What we found
            </h3>
            {discoveryStatus === 'discovering' && <span style={badgeStyle('cyan')}>Finding assets…</span>}
          </div>
          {discoveryError && discoveredCount === 0 && (
            <p role="alert" style={{ margin: '0 0 10px', color: C.danger, fontSize: 12 }}>{discoveryError}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 10 }}>
            {businessName && (
              <div>
                <div style={labelStyle}>Business</div>
                <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{businessName}</div>
              </div>
            )}
            {clientForm.industry && (
              <div>
                <div style={labelStyle}>Industry</div>
                <div style={{ color: C.text, fontSize: 13 }}>{clientForm.industry}</div>
              </div>
            )}
            {clientForm.location && (
              <div>
                <div style={labelStyle}>Location</div>
                <div style={{ color: C.text, fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <MapPin size={12} color={C.muted} /> {clientForm.location}
                </div>
              </div>
            )}
            {clientForm.phone && (
              <div>
                <div style={labelStyle}>Phone</div>
                <div style={{ color: C.text, fontSize: 13 }}>{clientForm.phone}</div>
              </div>
            )}
            {website && (
              <div>
                <div style={labelStyle}>Website</div>
                <div style={{ color: C.text, fontSize: 13, wordBreak: 'break-all' }}>{website}</div>
              </div>
            )}
            <div>
              <div style={labelStyle}>Logo found</div>
              <div style={{ color: logoCount > 0 ? C.green : C.muted, fontSize: 13 }}>
                {logoCount > 0 ? `Yes — ${logoCount} logo${logoCount === 1 ? '' : 's'}` : 'Not yet — you can add one in Advanced Editing'}
              </div>
            </div>
            {discoveredCount > 0 && (
              <div>
                <div style={labelStyle}>Assets found</div>
                <div style={{ color: C.text, fontSize: 13 }}>{discoveredCount} ready to review</div>
              </div>
            )}
          </div>

          {researchSummary && (researchSummary.title || researchSummary.description) && (
            <div style={{ ...softPanelStyle, marginTop: 12 }}>
              {researchSummary.title && <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{researchSummary.title}</div>}
              {researchSummary.description && (
                <p style={{ margin: '4px 0 0', color: C.muted, fontSize: 12, lineHeight: 1.55 }}>{researchSummary.description}</p>
              )}
            </div>
          )}

          {/* ── Inline discovery review ────────────────────────────────────
              The customer reviews and imports the discovered assets HERE,
              without being sent to Advanced Editing. This is the same
              provider flow the advanced view uses (toggle selection +
              importDiscoveredAssets); only the presentation is guided. */}
          {(discoveredCount > 0 || discoveredAssets.some((a) => a.rejected)) && (
            <div style={{ ...softPanelStyle, marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <h4 style={{ margin: 0, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: C.text }}>
                  Discovered assets
                </h4>
                <span style={badgeStyle('cyan')}>
                  {selectedDiscoveredCount} of {discoveredCount} selected
                </span>
              </div>
              {/* The same grid as Advanced Editing: every asset, grouped by
                  category, with select, remove / restore, category, Edit with
                  AI, full-screen viewer, and drag onto a section. */}
              <DiscoveredAssetGrid
                assets={discoveredAssets}
                onToggle={toggleDiscoveredAssetSelection}
                onRemove={rejectDiscoveredAsset}
                onCategoryChange={updateDiscoveredAssetCategory}
                onEdit={onEditAsset}
                onRevert={revertDiscoveredAssetEdit}
                onRemoveFromSection={removeDiscoveredAssetFromSection}
                onRestoreAll={() => setDiscoveredAssets(discoveredAssets.map((a) => ({ ...a, rejected: false })))}
                dropZones={SIMPLE_MODE_DROP_ZONES}
                onDropToSection={(id, section) => {
                  moveDiscoveredAssetToSection(id, section)
                  void importDiscoveredAssets({ ids: [id], section })
                }}
              />
              {discoveryStatus === 'importing' && (
                <p style={{ margin: '8px 0 0', color: C.cyan, fontSize: 11 }}>Importing assets…</p>
              )}
              {discoveryError && (
                <p style={{ margin: '8px 0 0', color: C.danger, fontSize: 11, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span>{discoveryError}</span>
                  <button type="button" onClick={() => importDiscoveredAssets()} style={{ ...secondaryButtonStyle, minHeight: 28 }}>
                    Retry
                  </button>
                </p>
              )}
              {importConfirmation && (
                <p style={{ margin: '8px 0 0', color: importConfirmation.count > 0 ? C.green : C.danger, fontSize: 11 }}>
                  {importConfirmation.count > 0
                    ? `${importConfirmation.count} asset${importConfirmation.count === 1 ? '' : 's'} added${importConfirmation.clientName ? ` to ${importConfirmation.clientName}` : ''}.`
                    : 'The selected assets could not be added.'}
                </p>
              )}
              {discoveryError && /failed to upload/i.test(discoveryError) && (
                <p style={{ margin: '6px 0 0', color: C.muted, fontSize: 10, lineHeight: 1.5 }}>
                  The selected assets are in this session and can still be used to personalize the video. Retry to
                  save them to your library.
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => importDiscoveredAssets()}
                  disabled={selectedDiscoveredCount === 0 || discoveryStatus === 'importing'}
                  style={{
                    ...primaryButtonStyle,
                    minHeight: 34,
                    opacity: selectedDiscoveredCount === 0 || discoveryStatus === 'importing' ? 0.5 : 1,
                  }}
                >
                  {discoveryStatus === 'importing' ? 'Importing…' : `Use ${selectedDiscoveredCount || 'selected'} asset${selectedDiscoveredCount === 1 ? '' : 's'}`}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => saveClient()} style={{ ...secondaryButtonStyle, minHeight: 36 }}>
              Save this business
            </button>
            {discoveredCount > 0 && (
              <button type="button" onClick={() => setViewMode('advanced')} style={{ ...secondaryButtonStyle, minHeight: 36 }}>
                Review assets in Advanced Editing
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
