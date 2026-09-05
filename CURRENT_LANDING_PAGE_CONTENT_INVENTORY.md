# SmartVideo AI Landing Page — Current Content Inventory

**Generated:** 2026-08-11  
**Purpose:** Audit of the CURRENT landing page before enhancement. Every item defaults to KEEP.

---

## Section Inventory

| Section | File | Current Content | Keep? | Enhancement Opportunity |
|---------|------|-----------------|-------|------------------------|
| Header | `Header.jsx` | Sticky nav, logo "Timeline Editor", nav links, Sign In / Get Started | KEEP | Add studio thumbnail strip below nav |
| HeroSection | `HeroSection.jsx` | Typewriter headline, trust badge, CTAs, stats, scroll indicator | KEEP | ADD: studio thumbnail gallery |
| ScrollingAppStrip | `ScrollingAppStrip.jsx` | 33 app chips scrolling, 60+ feature chips | KEEP | Already visual |
| HookSection | `HookSection.jsx` | Badge, headline, subheadline, 2 CTAs | KEEP | ADD: studio thumbnail row |
| SixEnginesSection | `SixEnginesSection.jsx` | 6 engine cards with icons, stats bar | KEEP | ADD: studio thumbnails in engine cards |
| AppsGridSection | `AppsGridSection.jsx` | 33 app cards with emoji icons, search, filters, CTA | KEEP | ADD: studio thumbnails + tool previews |
| DemosSection | `DemosSection.jsx` | 3 demo cards (Image/Video/Character), stats, CTA | KEEP | ADD: sample media galleries above demos |
| FeaturesSection | `FeaturesSection.jsx` | Empty (no categories prop passed) | KEEP | Could populate with historical content |
| ProblemSection | `ProblemSection.jsx` | 3 problem cards, solution reveal | KEEP | ADD: category thumbnail strip |
| WorkflowSection | `WorkflowSection.jsx` | 5 workflow steps with icons, CTA | KEEP | ADD: studio thumbnails in step badges |
| ComparisonSection | `ComparisonSection.jsx` | Red vs Cyan comparison table | KEEP | No visual assets needed |
| ValueStackSection | `ValueStackSection.jsx` | Value stack boxes, 6 engine cards, professional features | KEEP | Could add visual thumbnails |
| AgencySection | `AgencySection.jsx` | 4 benefit cards, mock dashboard | KEEP | ADD: sample work gallery |
| OfferSection | `OfferSection.jsx` | 2 pricing cards, feature tabs, social proof | KEEP | ADD: template gallery |
| FinalCTASection | `FinalCTASection.jsx` | Final headline, 2 CTAs, guarantee, footer links | KEEP | No visual assets needed |

---

## Images & Thumbnails Currently Used

**None.** The current landing page uses only:
- CSS gradients
- Emoji icons
- Inline SVG
- JS animations

No `<img>` tags or external image/video references exist in any landing component.

---

## Demo Components (Already Exist)

| Component | File | Status |
|-----------|------|--------|
| ImageGenDemo | `src/components/landing/demos/ImageGenDemo.jsx` | EXISTS — mock UI with gradients |
| VideoGenDemo | `src/components/landing/demos/VideoGenDemo.jsx` | EXISTS — mock UI with progress bar |
| CharacterDemo | `src/components/landing/demos/CharacterDemo.jsx` | EXISTS — mock UI with style select |
| DemosSection | `src/components/landing/sections/DemosSection.jsx` | EXISTS — orchestrates 3 demos |

---

## Available but Unused Historical Assets

| Asset Type | Location | Count | Status |
|-----------|----------|-------|--------|
| Studio thumbnails | `public/thumbnails/studios/` | 15 | AVAILABLE |
| Hero thumbnails | `public/thumbnails/heroes/` | 21 | AVAILABLE |
| Tool thumbnails | `public/thumbnails/tools/` | 13 | AVAILABLE |
| Template thumbnails | `public/thumbnails/templates/` | 252 | AVAILABLE |
| Effect previews | `public/thumbnails/effects/` | 300+ | AVAILABLE |
| Category thumbnails | `public/thumbnails/categories/` | 8 | AVAILABLE |
| Video agent thumbnails | `public/thumbnails/videoagent/` | 78 | AVAILABLE |
| Sample video | `apps/ai-vfx/public/sample-video.mp4` | 1 | AVAILABLE |
| Docs assets | `docs/assets/` | 3 | AVAILABLE |

---

## Branding

- **Current:** "AI Video Agency Studio" (in landing components)
- **Meta tags:** "SmartVideo" (in `index.html`)
- **Rule:** Keep current landing page branding. Only new user-facing content uses "SmartVideo AI".

---

## Protected Systems

| System | Status |
|--------|--------|
| Director | UNTOUCHED |
| Video Agent | UNTOUCHED |
| Timeline | UNTOUCHED |
| Render | UNTOUCHED |
