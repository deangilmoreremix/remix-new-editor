/**
 * Brand Kit panel: shown after Find My Brand has found a business. One click saves what was found
 * (logo, colors, copy, socials, images) as a Brand DNA record every studio can read; a second opens
 * Video Studio with an ad brief built from it. Nothing is saved until the user presses Save.
 */
import { useMemo, useState } from 'react'
import { useDemoPersonalize } from './DemoPersonalizeProvider'
import { buildBrandKit, saveBrandKit, makeBrandAd, buildBrandAdPlan } from '../../../../lib/brandKit.js'
import { C } from './guided/tokens'

type Aspect = '9:16' | '16:9'

export function BrandKitPanel() {
  const { businessResearch, clientForm, discoveredAssets, closePersonalize } = useDemoPersonalize() as any
  const research = businessResearch?.status === 'done' ? businessResearch.result : null
  const [saved, setSaved] = useState<any>(null)
  const [duration, setDuration] = useState(15)
  const [aspect, setAspect] = useState<Aspect>('9:16')

  const kit = useMemo(
    () => buildBrandKit({ research: research || {}, client: clientForm || {}, assets: discoveredAssets || [] }),
    [research, clientForm, discoveredAssets],
  )
  if (!kit || (!research && (discoveredAssets || []).length === 0)) return null

  const images = (kit.siteImages || []).length
  const plan = buildBrandAdPlan(saved || kit, { duration, aspectRatio: aspect })
  const btn = (primary: boolean) => ({
    minHeight: 34, padding: '0 14px', borderRadius: 10, fontSize: 11, fontWeight: 900,
    border: `1px solid ${primary ? C.cyan : C.cyanBorder}`,
    background: primary ? C.cyan : 'transparent', color: primary ? '#000' : C.cyan,
  }) as const

  const save = () => { setSaved(saveBrandKit(kit)) }
  const makeAd = () => {
    const brand = saved || saveBrandKit(kit)
    setSaved(brand)
    makeBrandAd(brand, { duration, aspectRatio: aspect })
    closePersonalize?.()
  }

  return (
    <div
      data-testid="pz-brand-kit"
      style={{ marginTop: 14, padding: 14, borderRadius: 12, border: `1px solid ${C.cyanBorder}`, background: C.cyanSoft }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: C.cyan, marginBottom: 8 }}>
        Brand Kit
      </div>
      <div className="flex items-center flex-wrap" style={{ gap: 10, marginBottom: 10 }}>
        {kit.logoUrl && <img src={kit.logoUrl} alt="" style={{ height: 36, maxWidth: 96, objectFit: 'contain', borderRadius: 6, background: '#fff', padding: 3 }} />}
        <div style={{ minWidth: 0 }}>
          <div style={{ color: C.text, fontWeight: 800, fontSize: 13 }}>{kit.brandName}</div>
          <div style={{ color: C.muted, fontSize: 11 }}>
            {[kit.industry, `${images} image${images === 1 ? '' : 's'}`, Object.keys(kit.socials).length ? `${Object.keys(kit.socials).length} social link${Object.keys(kit.socials).length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="flex" style={{ gap: 4 }} aria-label="Brand colors">
          {[...kit.primaryColors, ...kit.secondaryColors].map((c: string) => (
            <span key={c} title={c} style={{ width: 18, height: 18, borderRadius: 9, background: c, border: '1px solid rgba(255,255,255,.25)' }} />
          ))}
        </div>
      </div>
      {kit.valueProposition && (
        <p style={{ margin: '0 0 10px', color: C.muted, fontSize: 11, lineHeight: 1.5 }}>{kit.valueProposition.slice(0, 220)}</p>
      )}
      <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
        <button type="button" onClick={save} style={btn(false)} data-testid="pz-brand-kit-save">
          {saved ? '✓ Saved to Brand Studio' : 'Save Brand Kit'}
        </button>
        <select
          aria-label="Ad length"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          style={{ ...btn(false), background: 'transparent' }}
        >
          {[8, 15, 30].map((d) => <option key={d} value={d} style={{ color: '#000' }}>{d}s</option>)}
        </select>
        <select
          aria-label="Ad shape"
          value={aspect}
          onChange={(e) => setAspect(e.target.value as Aspect)}
          style={{ ...btn(false), background: 'transparent' }}
        >
          <option value="9:16" style={{ color: '#000' }}>Vertical 9:16</option>
          <option value="16:9" style={{ color: '#000' }}>Widescreen 16:9</option>
        </select>
        <button type="button" onClick={makeAd} style={btn(true)} data-testid="pz-brand-kit-make-ad" title={plan?.prompt}>
          {`Make a ${duration}s ad →`}
        </button>
      </div>
    </div>
  )
}
