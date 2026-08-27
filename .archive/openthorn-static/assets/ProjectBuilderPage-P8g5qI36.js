var Ss=Object.defineProperty;var Cs=(e,t,o)=>t in e?Ss(e,t,{enumerable:!0,configurable:!0,writable:!0,value:o}):e[t]=o;var dt=(e,t,o)=>Cs(e,typeof t!="symbol"?t+"":t,o);import{j as s}from"./vendor-motion-Bz0BK0Zu.js";import{g as Es,d as y,h as Ts,i as Ns,u as Is,r as As}from"./vendor-react-OCkIFBX-.js";import{r as F,u as So,A as yn,n as Bt,a as Rs,D as Ls,b as Ms,k as Ps,o as $s,_ as Os,w as Ds,f as J,e as Se,i as Bs,d as Fs,c as Us}from"./index-CgxiKb8A.js";import{r as Ws,h as Hs}from"./vendor-export-CIUtDj8s.js";import{a as qs,A as Gs,c as ht,f as Yn,r as zs,b as Vs,d as Xn,e as Co}from"./preview-bundle-Iw6MdIEJ.js";import{d as Ks,e as Js}from"./crypto-7e3RF6gQ.js";import{M as Ys,r as Xs}from"./index-Dg2PGnGU.js";import"./vendor-esbuild-BtTWknlI.js";var Zs=Ws();const Qs=Es(Zs);async function ei(e,t,o){var h;const{data:n}=await F.auth.getSession(),i=(h=n.session)==null?void 0:h.access_token;if(!i)throw new Error("You must be signed in to publish a site.");const r=await fetch("/api/deploy",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${i}`},body:JSON.stringify({projectId:e,html:t,existingSiteId:o})});if(!r.ok){const a=await r.text().catch(()=>r.statusText);throw new Error(`Deploy failed: ${a||r.statusText}`)}const l=await r.json();if(!(l!=null&&l.url)||!(l!=null&&l.siteId))throw new Error("Deploy failed: invalid response from deploy endpoint");return{url:String(l.url),siteId:String(l.siteId)}}async function Xe(e,t,o="/api/supabase-oauth"){const n=await fetch(o,{method:"POST",headers:{Authorization:`Bearer ${e}`,"Content-Type":"application/json"},body:JSON.stringify(t)});if(!n.ok){const i=await n.json().catch(()=>({}));throw new Error(i.error||`Request failed ${n.status}`)}return n.json()}function Eo(e,t){return`/api/supabase-oauth?${new URLSearchParams({action:"start",token:e,projectId:t}).toString()}`}function To(e){return Xe(e,{action:"list-projects"})}function No(e,t,o){return Xe(e,{action:"pick-project",projectId:t,ref:o})}function Io(e,t){return Xe(e,{action:"disconnect-project",projectId:t})}function ti(e){return Xe(e,{action:"revoke"})}function Ao(e,t){return Xe(e,{action:"create-project",name:t})}function ni(e,t,o){return Xe(e,{projectId:t,spec:o},"/api/migrate")}const oi=Object.freeze(Object.defineProperty({__proto__:null,applySchema:ni,authorizeUrl:Eo,createProject:Ao,disconnectProject:Io,listProjects:To,pickProject:No,revokeBackend:ti},Symbol.toStringTag,{value:"Module"})),si="_panel_25aw4_1",ii="_title_25aw4_10",ri="_desc_25aw4_16",ai="_primary_25aw4_23",li="_secondary_25aw4_33",ci="_projectBtn_25aw4_34",di="_list_25aw4_55",ui="_ref_25aw4_64",pi="_connected_25aw4_70",hi="_error_25aw4_76",mi="_addBtn_25aw4_82",fi="_newRow_25aw4_93",gi="_newInput_25aw4_100",Z={panel:si,title:ii,desc:ri,primary:ai,secondary:li,projectBtn:ci,list:di,ref:ui,connected:pi,error:hi,addBtn:mi,newRow:fi,newInput:gi},nn="ACTIVE_HEALTHY";function yi(e){return e==="COMING_UP"||e==="UNKNOWN"||e==="INITIATING"?"provisioning…":e==="INACTIVE"||e==="PAUSED"?"paused":e==="RESTORING"?"restoring…":e.toLowerCase().replace(/_/g," ")}function bi({projectId:e,onStatusChange:t}){const{session:o}=So(),n=(o==null?void 0:o.access_token)??"",[i,r]=y.useState(null),[l,h]=y.useState(null),[a,m]=y.useState(!1),[f,u]=y.useState(!1),[v,b]=y.useState(null),[w,_]=y.useState(!1),[A,k]=y.useState(""),[j,I]=y.useState(!1),S=y.useCallback(async()=>{const{data:R}=await F.from("project_backends").select("project_ref").eq("project_id",e).maybeSingle(),C=!!R;r(C),t==null||t(C)},[e,t]);y.useEffect(()=>{S()},[S]);const N=y.useCallback(async()=>{if(n)try{const{projects:R}=await To(n);h(R),m(!1)}catch(R){const C=R instanceof Error?R.message:"";/no supabase connection/i.test(C)?m(!0):b(C||"Failed to load projects")}},[n]);y.useEffect(()=>{if(i===!1){N();const R=new URLSearchParams(window.location.search);R.get("backend")==="error"&&b(R.get("message")||"Authorization failed")}},[i,N]);const L=y.useRef(null);y.useEffect(()=>{if(!(l??[]).some(C=>C.status!==nn)){L.current&&(clearInterval(L.current),L.current=null);return}if(!L.current)return L.current=setInterval(()=>{N()},8e3),()=>{L.current&&(clearInterval(L.current),L.current=null)}},[l,N]);const H=y.useCallback(async R=>{u(!0),b(null);try{await No(n,e,R),await S()}catch(C){b(C instanceof Error?C.message:"Failed to connect project")}finally{u(!1)}},[n,e,S]),$=y.useCallback(async()=>{const R=A.trim();if(R){I(!0),b(null);try{const{project:C}=await Ao(n,R);h(D=>[C,...(D??[]).filter(te=>te.ref!==C.ref)]),_(!1),k("")}catch(C){b(C instanceof Error?C.message:"Failed to create project")}finally{I(!1)}}},[n,A]),P=y.useCallback(async()=>{u(!0),b(null);try{await Io(n,e),h(null),m(!1),await S()}catch(R){b(R instanceof Error?R.message:"Failed to disconnect")}finally{u(!1)}},[n,e,S]);return i===null?null:i?s.jsxs("div",{className:Z.panel,children:[s.jsx("p",{className:Z.connected,children:"Backend connected ✓"}),s.jsx("p",{className:Z.desc,children:"This app can use a database and user accounts."}),s.jsx("button",{className:Z.secondary,type:"button",disabled:f,onClick:P,children:"Disconnect"}),v&&s.jsx("p",{className:Z.error,children:v})]}):s.jsxs("div",{className:Z.panel,children:[s.jsx("h3",{className:Z.title,children:"Add a backend"}),s.jsx("p",{className:Z.desc,children:"Connect your Supabase project to add a database, accounts, and saved data to this app."}),v&&s.jsx("p",{className:Z.error,children:v}),a&&s.jsx("a",{className:Z.primary,href:Eo(n,e),children:"Authorize Supabase"}),!a&&l&&s.jsxs(s.Fragment,{children:[w?s.jsxs("div",{className:Z.newRow,children:[s.jsx("input",{className:Z.newInput,type:"text",value:A,placeholder:"New project name",autoFocus:!0,disabled:j,onChange:R=>k(R.target.value),onKeyDown:R=>{R.key==="Enter"&&$()}}),s.jsx("button",{className:Z.primary,type:"button",disabled:j||!A.trim(),onClick:$,children:j?"Creating…":"Create"}),s.jsx("button",{className:Z.secondary,type:"button",disabled:j,onClick:()=>_(!1),children:"Cancel"})]}):s.jsx("button",{className:Z.addBtn,type:"button",onClick:()=>{_(!0),b(null)},children:"+ Add new project"}),s.jsxs("ul",{className:Z.list,children:[l.length===0&&!w&&s.jsx("li",{className:Z.desc,children:"No projects found in your Supabase org."}),l.map(R=>{const C=R.status===nn;return s.jsx("li",{children:s.jsxs("button",{className:Z.projectBtn,type:"button",disabled:f||!C,onClick:()=>H(R.ref),children:[R.name," ",s.jsx("span",{className:Z.ref,children:C?R.region:yi(R.status)})]})},R.ref)})]}),(l??[]).some(R=>R.status!==nn)&&s.jsx("p",{className:Z.desc,children:"New projects take a minute or two to provision — this list refreshes automatically."})]})]})}const on=1280,sn=800;async function vi(e){return new Promise(t=>{const o=document.createElement("iframe");o.style.cssText=`position:fixed;top:-9999px;left:-9999px;width:${on}px;height:${sn}px;border:none;opacity:0;pointer-events:none;`,o.setAttribute("sandbox","allow-scripts allow-same-origin"),document.body.appendChild(o);const n=()=>{try{document.body.removeChild(o)}catch{}},i=setTimeout(()=>{n(),t(null)},2e4);o.onload=async()=>{await new Promise(r=>setTimeout(r,2500));try{const r=await Hs(o.contentDocument.documentElement,{width:on,height:sn,scale:.5,useCORS:!0,allowTaint:!0,logging:!1,windowWidth:on,windowHeight:sn});clearTimeout(i),r.toBlob(l=>{n(),t(l)},"image/png")}catch(r){console.warn("Preview screenshot failed:",r),clearTimeout(i),n(),t(null)}},o.srcdoc=e})}const wi="_popover_l9r4a_1",_i="_header_l9r4a_16",ki="_tag_l9r4a_22",xi="_loc_l9r4a_27",ji="_close_l9r4a_33",Si="_section_l9r4a_48",Ci="_label_l9r4a_61",Ei="_badge_l9r4a_72",Ti="_textInput_l9r4a_83",Ni="_input_l9r4a_84",Ii="_chips_l9r4a_106",Ai="_chip_l9r4a_106",Ri="_textBtn_l9r4a_127",Li="_apply_l9r4a_128",se={popover:wi,header:_i,tag:ki,loc:xi,close:ji,section:Si,label:Ci,badge:Ei,textInput:Ti,input:Ni,chips:Ii,chip:Ai,textBtn:Ri,apply:Li},Mi=[{label:"Restyle",seed:"Restyle this element: "},{label:"Spacing",seed:"Adjust the spacing/padding of this element: "},{label:"Delete",seed:"Remove this element."}],Zn={width:300,height:250};function Pi({selection:e,frameOffset:t,busy:o,onTextEdit:n,onSubmit:i,onClose:r}){const l=e.text.trim().length>0,[h,a]=y.useState(e.text),[m,f]=y.useState(""),u=y.useRef(null);y.useEffect(()=>{a(e.text),f("")},[e]);const v=qs({top:e.rect.top+t.top,left:e.rect.left+t.left,width:e.rect.width,height:e.rect.height},Zn,{width:window.innerWidth,height:window.innerHeight}),b=l&&h.trim()!==e.text.trim()&&h.trim().length>0,w=()=>{!b||o||n(e,h.trim())},_=()=>{!m.trim()||o||i(m,e)},A=e.oeid?e.oeid.split(":").slice(0,2).join(":"):"unknown";return s.jsxs("div",{className:se.popover,style:{top:v.top,left:v.left,width:Zn.width},role:"dialog","aria-label":"Edit selected element",children:[s.jsxs("div",{className:se.header,children:[s.jsxs("span",{className:se.tag,children:["<",e.tag,">"]}),s.jsx("span",{className:se.loc,children:A}),s.jsx("button",{className:se.close,onClick:r,"aria-label":"Close",children:"×"})]}),l&&s.jsxs("div",{className:se.section,children:[s.jsxs("label",{className:se.label,htmlFor:"oe-text",children:["Text ",s.jsx("span",{className:se.badge,children:"instant"})]}),s.jsx("input",{id:"oe-text",className:se.textInput,value:h,onChange:k=>a(k.target.value),onKeyDown:k=>{k.key==="Enter"&&(k.preventDefault(),w())}}),s.jsx("button",{className:se.textBtn,onClick:w,disabled:!b||o,children:"Update text"})]}),s.jsxs("div",{className:se.section,children:[s.jsx("span",{className:se.label,children:"Ask AI"}),s.jsx("div",{className:se.chips,children:Mi.map(k=>s.jsx("button",{className:se.chip,onClick:()=>{var j;f(k.seed),(j=u.current)==null||j.focus()},children:k.label},k.label))}),s.jsx("textarea",{ref:u,className:se.input,value:m,placeholder:"Describe a change…",onChange:k=>f(k.target.value),onKeyDown:k=>{k.key==="Enter"&&!k.shiftKey&&(k.preventDefault(),_())}}),s.jsx("button",{className:se.apply,onClick:_,disabled:!m.trim()||o,children:o?"Applying…":"Apply with AI"})]})]})}const $i=`# UI/UX Pro Max — Design Intelligence

Comprehensive design guide for web and mobile applications. Contains 50+ styles, 161 color palettes, 57 font pairings, 161 product types with reasoning rules, 99 UX guidelines, and 25 chart types. Priority-based recommendations across all major domains.

## When to Apply

Use when the task involves **UI structure, visual design decisions, interaction patterns, or user experience quality control**:
- Designing new pages (Landing Page, Dashboard, Admin, SaaS, E-commerce)
- Creating or refactoring UI components (buttons, modals, forms, tables, charts)
- Choosing color schemes, typography systems, spacing standards, or layout systems
- Reviewing UI code for UX, accessibility, or visual consistency
- Implementing navigation structures, animations, or responsive behavior
- Making product-level design decisions (style, information hierarchy, brand expression)
- Improving perceived quality, clarity, or usability of interfaces

Skip only for: pure backend logic, API/database design, infrastructure/DevOps, non-visual automation.

## Rule Categories by Priority

| Priority | Category | Impact | Key Checks | Anti-Patterns |
|----------|----------|--------|------------|---------------|
| 1 | Accessibility | CRITICAL | Contrast 4.5:1, alt text, keyboard nav, aria-labels | Removing focus rings, icon-only buttons without labels |
| 2 | Touch & Interaction | CRITICAL | Min 44×44px, 8px+ spacing, loading feedback | Hover-only interactions, instant state changes (0ms) |
| 3 | Performance | HIGH | WebP/AVIF, lazy loading, reserve space (CLS < 0.1) | Layout thrashing, Cumulative Layout Shift |
| 4 | Style Selection | HIGH | Match product type, consistency, SVG icons (no emoji) | Mixing flat & skeuomorphic randomly, emoji as icons |
| 5 | Layout & Responsive | HIGH | Mobile-first breakpoints, viewport meta, no horizontal scroll | Horizontal scroll, fixed px container widths, disable zoom |
| 6 | Typography & Color | MEDIUM | Base 16px, line-height 1.5, semantic color tokens | Text < 12px body, gray-on-gray, raw hex in components |
| 7 | Animation | MEDIUM | 150–300ms, motion conveys meaning, spatial continuity | Decorative-only animation, animating width/height, no reduced-motion |
| 8 | Forms & Feedback | MEDIUM | Visible labels, error near field, helper text, progressive disclosure | Placeholder-only label, errors only at top, overwhelm upfront |
| 9 | Navigation Patterns | HIGH | Predictable back, breadcrumbs on deep hierarchies, deep linking | Overloaded nav, broken back behavior, no deep links |
| 10 | Charts & Data | LOW | Legends, tooltips, accessible colors | Relying on color alone to convey meaning |

---

## §1 Accessibility (CRITICAL)

- **color-contrast** — min 4.5:1 for normal text, 3:1 for large text (18px+ bold or 24px+ regular)
- **focus-states** — visible focus rings on all interactive elements (2–4px outline); never \`outline: none\` without a replacement
- **alt-text** — descriptive alt for meaningful images; \`aria-hidden\` for decorative ones
- **aria-labels** — \`aria-label\` for icon-only buttons; never a clickable \`<div>\` without a role
- **keyboard-nav** — tab order matches visual order; every action reachable by keyboard alone
- **form-labels** — every \`<input>\`, \`<select>\`, \`<textarea>\` needs an associated \`<label>\`
- **heading-hierarchy** — sequential h1→h6, no skipped levels
- **color-not-only** — don't convey information by color alone; add icon or text
- **reduced-motion** — wrap animations in \`@media (prefers-reduced-motion: no-preference)\`
- **skip-links** — "Skip to main content" as first focusable element on complex pages
- **dynamic-type** — support system text scaling; avoid truncation as text grows
- **voiceover-sr** — meaningful aria labels/hints; logical reading order for screen readers
- **escape-routes** — provide cancel/back in modals and multi-step flows
- **keyboard-shortcuts** — preserve system and a11y shortcuts; offer keyboard alternatives for drag-and-drop

## §2 Touch & Interaction (CRITICAL)

- **touch-target-size** — min 44×44px interactive area; extend hit area beyond visual bounds if needed
- **touch-spacing** — minimum 8px gap between interactive elements
- **hover-vs-tap** — use click/tap for primary interactions; don't rely on hover alone
- **loading-buttons** — disable button during async operations; show spinner or "Loading…"
- **error-feedback** — clear error messages near the problem element
- **cursor-pointer** — \`cursor: pointer\` on all clickable non-button elements
- **tap-delay** — use \`touch-action: manipulation\` to eliminate 300ms tap delay on mobile
- **press-feedback** — visual feedback on press within 80–150ms
- **gesture-alternative** — don't rely on gesture-only interactions; always provide visible controls for critical actions
- **no-precision-required** — avoid requiring pixel-perfect taps on small icons or thin edges

## §3 Performance (HIGH)

- **image-optimization** — use WebP/AVIF, responsive images (srcset/sizes), lazy load non-critical assets
- **image-dimension** — declare width/height or use aspect-ratio to prevent layout shift (CLS)
- **font-loading** — use \`font-display: swap\` to avoid invisible text (FOIT); reserve space to reduce layout shift
- **font-preload** — preload only critical fonts; avoid overusing preload on every variant
- **critical-css** — prioritize above-the-fold CSS (inline critical CSS or early-loaded stylesheet)
- **lazy-loading** — lazy load non-hero components via dynamic import / route-level splitting
- **bundle-splitting** — split code by route/feature to reduce initial load and TTI
- **third-party-scripts** — load third-party scripts async/defer; audit and remove unnecessary ones
- **reduce-reflows** — avoid frequent layout reads/writes; batch DOM reads then writes
- **content-jumping** — reserve space for async content to avoid layout jumps (CLS)
- **virtualize-lists** — virtualize lists with 50+ items for memory efficiency and scroll performance
- **main-thread-budget** — keep per-frame work under ~16ms for 60fps
- **progressive-loading** — use skeleton screens / shimmer instead of long blocking spinners for >1s operations
- **input-latency** — keep input latency under ~100ms for taps/scrolls
- **debounce-throttle** — use debounce/throttle for high-frequency events (scroll, resize, input)
- **offline-support** — provide offline state messaging and basic fallback

## §4 Style Selection (HIGH)

- **style-match** — match style to product: SaaS→clean/minimal, portfolio→editorial, e-commerce→warm, gaming→bold/dark, fintech→trustworthy
- **consistency** — same visual style across all pages; don't mix glass + flat + clay
- **no-emoji-icons** — use SVG icons (Lucide, Heroicons, Phosphor), not emojis
- **effects-match-style** — shadows, blur, border-radius aligned with chosen style
- **state-clarity** — hover/pressed/disabled states visually distinct while staying on-style
- **elevation-consistent** — consistent shadow scale for cards/modals; no random shadow values
- **dark-mode-pairing** — dark mode uses desaturated tonal variants, not inverted colors
- **icon-style-consistent** — one icon set/stroke weight across the product
- **primary-action** — one primary CTA per screen; secondary actions visually subordinate
- **blur-purpose** — use blur to indicate background dismissal (modals, sheets), not as decoration

## §5 Layout & Responsive (HIGH)

- **viewport-meta** — \`width=device-width, initial-scale=1\`; never disable zoom
- **mobile-first** — design 390px first, scale up to 768px and 1280px+
- **breakpoint-consistency** — systematic breakpoints: 390 / 768 / 1024 / 1440
- **readable-font-size** — minimum 16px body on mobile (prevents iOS auto-zoom)
- **line-length-control** — 35–60 chars/line on mobile; 60–75 on desktop
- **horizontal-scroll** — no horizontal scroll on mobile
- **spacing-scale** — 4/8/12/16/24/32/48/64px system; no arbitrary values
- **container-width** — consistent max-width on desktop (e.g. 1200px / \`max-w-6xl\`)
- **z-index-management** — explicit z-index scale (0 / 10 / 20 / 40 / 100 / 1000)
- **viewport-units** — prefer \`min-h-dvh\` over \`100vh\` on mobile
- **visual-hierarchy** — hierarchy via size, spacing, contrast — not color alone
- **fixed-element-offset** — fixed navbar/bottom bar must reserve safe padding for underlying content
- **scroll-behavior** — avoid nested scroll regions that interfere with the main scroll experience
- **orientation-support** — keep layout readable and operable in landscape mode
- **content-priority** — show core content first on mobile; fold or hide secondary content

## §6 Typography & Color (MEDIUM)

- **line-height** — 1.5–1.75 for body text; 1.1–1.3 for headings
- **font-scale** — consistent type scale (e.g. 12/14/16/20/24/32/48px)
- **font-pairing** — match heading and body personalities; avoid Inter/Roboto/Arial for distinctive work
- **weight-hierarchy** — Bold headings (600–700), Regular body (400), Medium labels (500)
- **color-semantic** — CSS custom properties (--color-primary, --color-error, --color-surface), not raw hex in components
- **color-dark-mode** — test dark mode contrast independently; desaturated tonal variants only
- **color-accessible-pairs** — every foreground/background pair must meet 4.5:1 (WCAG AA)
- **color-not-decorative-only** — functional color (error red) must also use icon/text
- **whitespace-balance** — intentional whitespace to group items; avoid clutter and over-padding
- **number-tabular** — monospaced figures for prices, data columns, timers
- **truncation-strategy** — prefer wrapping over truncation; when truncating use ellipsis + tooltip with full text
- **letter-spacing** — avoid tight tracking on body text; respect natural letterfit

## §7 Animation (MEDIUM)

- **duration-timing** — 150–300ms for micro-interactions; ≤400ms for complex; never >500ms
- **transform-performance** — animate \`transform\` and \`opacity\` only; never width/height/top/left
- **easing** — \`ease-out\` entering; \`ease-in\` exiting; never \`linear\` for UI transitions
- **motion-meaning** — every animation expresses cause-effect; no purely decorative motion
- **exit-faster-than-enter** — exit ~65% of enter duration (feels more responsive)
- **stagger-sequence** — stagger list/grid entrances 30–50ms apart; not all-at-once
- **spring-physics** — spring curves for natural feel over rigid cubic-bezier
- **loading-states** — skeleton/shimmer when loading >300ms; never blank-then-pop
- **reduced-motion** — \`@media (prefers-reduced-motion: no-preference) { ... }\` around all animations
- **no-blocking-animation** — never block user input during animation
- **interruptible** — animations must be interruptible by user tap/gesture immediately
- **state-transition** — state changes (hover/active/expanded) should animate smoothly, not snap
- **scale-feedback** — subtle scale (0.95–1.05) on press for tappable cards/buttons
- **layout-shift-avoid** — animations must not cause layout reflow; use transform for position changes

## §8 Forms & Feedback (MEDIUM)

- **input-labels** — visible \`<label>\` per input; never placeholder-only
- **error-placement** — error message directly below the offending field
- **inline-validation** — validate on blur, not on every keystroke
- **submit-feedback** — loading → success/error state on submit; disable button while pending
- **progressive-disclosure** — reveal complex options progressively; don't overwhelm upfront
- **empty-states** — helpful message + action when no content exists
- **confirmation-dialogs** — confirm before destructive actions (delete, overwrite)
- **focus-management** — after submit error, auto-focus first invalid field
- **error-clarity** — error messages state cause + how to fix; not just "Invalid input"
- **touch-friendly-input** — mobile input height ≥44px
- **required-indicators** — mark required fields (asterisk + screen-reader text)
- **input-type-keyboard** — use semantic input types (email, tel, number) to trigger correct mobile keyboard
- **password-toggle** — provide show/hide toggle for password fields
- **autofill-support** — use autocomplete attributes so the system can autofill
- **undo-support** — allow undo for destructive or bulk actions ("Undo delete" toast)
- **success-feedback** — confirm completed actions with brief visual feedback (checkmark, toast, color flash)
- **error-recovery** — error messages must include a clear recovery path (retry, edit, help link)
- **multi-step-progress** — multi-step flows show step indicator or progress bar; allow back navigation
- **disabled-states** — disabled elements use reduced opacity (0.38–0.5) + cursor change + semantic attribute
- **toast-dismiss** — auto-dismiss toasts in 3–5s; accessible via aria-live="polite"
- **destructive-emphasis** — destructive actions use danger color (red) and are visually separated from primary actions

## §9 Navigation Patterns (HIGH)

- **back-behavior** — predictable and consistent; preserves scroll position and state
- **nav-state-active** — current location visually highlighted in navigation
- **nav-label-icon** — navigation items have both icon and text label; icon-only nav harms discoverability
- **breadcrumb-web** — breadcrumbs for hierarchies 3+ levels deep
- **modal-escape** — modals have clear close affordance (× button + Escape key); dismiss on backdrop click
- **adaptive-navigation** — ≥1024px: sidebar; <1024px: top/bottom nav
- **focus-on-route-change** — move focus to main content after page transition (screen readers)
- **navigation-consistency** — navigation placement identical across all pages
- **deep-linking** — all key screens must be reachable via URL for sharing
- **search-accessible** — search easily reachable (top bar or prominent); provide recent/suggested queries
- **state-preservation** — navigating back restores previous scroll position, filter state, and input
- **nav-hierarchy** — primary nav vs secondary nav (drawer/settings) must be clearly separated
- **persistent-nav** — core navigation must remain reachable from deep pages; don't hide in sub-flows
- **avoid-mixed-patterns** — don't mix Tab + Sidebar + Bottom Nav at the same hierarchy level
- **modal-vs-navigation** — modals must not be used for primary navigation flows; they break the user's path

## §10 Charts & Data (LOW)

- **chart-type** — match chart type to data: trend → line, comparison → bar, proportion → pie/donut (max 5 segments)
- **color-guidance** — accessible palettes; avoid red/green-only pairs for colorblind users
- **data-table** — provide table alternative for accessibility; charts alone aren't screen-reader friendly
- **pattern-texture** — supplement color with patterns/shapes so data is distinguishable without color
- **legend-visible** — always show legend near the chart, not detached below a scroll fold
- **tooltip-on-interact** — show tooltips on hover (web) or tap (mobile) with exact values
- **axis-labels** — label axes with units and readable scale; avoid truncated or rotated labels on mobile
- **responsive-chart** — charts reflow or simplify on small screens
- **empty-data-state** — meaningful empty state ("No data yet" + guidance), not a blank chart
- **loading-chart** — skeleton/shimmer while chart data loads; not empty axis frame
- **animation-optional** — chart entrance animations must respect prefers-reduced-motion
- **no-pie-overuse** — avoid pie/donut for >5 categories; switch to bar chart for clarity
- **tooltip-keyboard** — tooltip content must be keyboard-reachable, not hover-only
- **sortable-table** — data tables support sorting with aria-sort indicating current state
- **gridline-subtle** — grid lines should be low-contrast (gray-100/200) so they don't compete with data

---

## Icons & Visual Elements

| Rule | Do | Avoid |
|------|----|----|
| **No emoji as icons** | SVG icons (Lucide, Heroicons, Phosphor) | 🎨 🚀 ⚙️ in navigation or system controls |
| **Vector-only assets** | SVG icons that scale and support theming | Raster PNG icons that blur at high DPI |
| **Consistent icon set** | One family, one stroke weight | Mixing outline + filled icons at the same level |
| **Stable interaction states** | Opacity/color/elevation transitions | Layout-shifting transforms that move surrounding content |
| **Consistent icon sizing** | Design tokens (icon-sm=16px, icon-md=24px, icon-lg=32px) | Mixing 20/24/28px arbitrarily |
| **Icon contrast** | 4.5:1 for small, 3:1 minimum for larger UI glyphs | Low-contrast icons blending into background |

## Layout & Spacing Rules

| Rule | Do | Don't |
|------|----|----|
| **8px spacing rhythm** | 4/8/12/16/24/32/48/64px consistent spacing | Random spacing increments with no rhythm |
| **Container width** | Consistent max-width per breakpoint | Mixing arbitrary widths between pages |
| **Readable text measure** | Max-w for prose to keep line length under 75 chars | Full-width paragraphs on widescreen that hurt readability |
| **Section spacing hierarchy** | Tiers: 16/24/32/48px by content importance | Same spacing for all sections regardless of hierarchy |

## Light/Dark Mode

| Rule | Do | Don't |
|------|----|----|
| **Semantic tokens** | CSS custom properties mapped per theme | Hardcoded hex values per component |
| **Text contrast (light)** | Body text ≥4.5:1 against light surfaces | Low-contrast gray body text |
| **Text contrast (dark)** | Primary ≥4.5:1, secondary ≥3:1 on dark surfaces | Dark mode text that blends into background |
| **Border visibility** | Separators visible in both themes | Theme-specific borders disappearing in one mode |
| **State contrast parity** | Pressed/focused/disabled states equally distinguishable in both themes | Defining interaction states for one theme only |
| **Scrim legibility** | Modal scrim 40–60% black opacity | Weak scrim leaving background competing with foreground |

---

## Pre-Delivery Checklist

### Visual Quality
- [ ] No emojis used as icons (SVG only)
- [ ] All icons come from a consistent family and stroke weight
- [ ] Semantic theme tokens used consistently (no ad-hoc hardcoded colors)
- [ ] Pressed-state visuals do not shift layout bounds or cause jitter

### Interaction
- [ ] All tappable elements provide clear pressed feedback
- [ ] Touch targets meet minimum size (≥44×44px)
- [ ] Micro-interaction timing stays in the 150–300ms range
- [ ] Disabled states are visually clear and non-interactive
- [ ] Screen reader labels are descriptive and logical

### Light/Dark Mode
- [ ] Primary text contrast ≥4.5:1 in both modes
- [ ] Secondary text contrast ≥3:1 in both modes
- [ ] Dividers/borders and interaction states visible in both modes
- [ ] Both themes tested before delivery

### Layout
- [ ] No horizontal scroll on mobile
- [ ] Content not hidden behind fixed/sticky bars
- [ ] 4/8px spacing rhythm maintained
- [ ] Long-form text measure readable on larger viewports

### Accessibility
- [ ] All meaningful images/icons have accessible labels
- [ ] Form fields have labels, hints, and clear error messages
- [ ] Color is not the only indicator of meaning
- [ ] Reduced motion respected (animations gated behind prefers-reduced-motion)
- [ ] Focus order matches visual order
`,Oi=`# Frontend Design — Distinctive Interfaces

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian.
- **Differentiation**: What makes this UNFORGETTABLE? What is the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work — the key is intentionality, not intensity.

## Aesthetic Guidelines

- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial, Inter, Roboto, and system fonts. Pair a distinctive display font with a refined body font. Unexpected, characterful font choices.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Scroll-triggered reveals and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density — pick one and commit.
- **Backgrounds & Visual Details**: Create atmosphere and depth. Apply: gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, grain overlays. Never default to plain solid colors.

**NEVER use**: Inter, Roboto, Arial, or system fonts; purple gradients on white backgrounds; predictable card-grid layouts; cookie-cutter component patterns that lack context-specific character.

Vary between light and dark themes, different fonts, different aesthetics across generations. **NEVER** converge on the same choices — each project should feel uniquely designed.

Match implementation complexity to the vision: maximalist designs need elaborate animations and effects; minimalist designs need restraint, precision in spacing, and careful typography. Elegance comes from executing the vision well.

Remember: extraordinary creative work happens when thinking outside the box and committing fully to a distinctive vision.`,Di=`# React Best Practices

## Core Principle: Effects Are Escape Hatches

Effects let you "step outside" React to synchronize with external systems. **Most component logic should NOT use Effects.** Before writing an Effect, ask: "Is there a way to do this without an Effect?"

## Decision Tree

1. **Need to respond to user interaction?** Use event handler
2. **Need computed value from props/state?** Calculate during render
3. **Need cached expensive calculation?** Use \`useMemo\`
4. **Need to reset state on prop change?** Use \`key\` prop
5. **Need to synchronize with external system?** Use Effect with cleanup
6. **Need non-reactive code in Effect?** Use \`useEffectEvent\`
7. **Need mutable value that doesn't trigger render?** Use ref

## When to Use Effects

Synchronizing with **external systems**: browser APIs (WebSocket, IntersectionObserver), third-party non-React libraries, window/document event listeners, non-React DOM elements (video, maps).

## When NOT to Use Effects

- Derived state — calculate during render
- Expensive calculations — use \`useMemo\`
- Resetting state on prop change — use \`key\` prop
- Responding to user events — use event handlers
- Notifying parent of state changes — update both in the same event handler
- Chains of effects — calculate derived state and update in one event handler

## Refs

- Use for values that don't affect rendering (timer IDs, DOM node references)
- Never read or write \`ref.current\` during render; only in event handlers and effects
- Use ref callbacks (not \`useRef\` in loops) for dynamic lists
- Use \`useImperativeHandle\` to limit what parent can access

## Custom Hooks

- Share logic, not state — each call gets an independent state instance
- Name \`useXxx\` only if it actually calls other hooks; otherwise use a regular function
- Avoid lifecycle hooks (\`useMount\`, \`useEffectOnce\`) — use \`useEffect\` directly so the linter catches missing deps
- Keep focused on a single concrete use case

## Component Patterns

- Controlled: parent owns state; uncontrolled: component owns state
- Prefer composition with \`children\` over prop drilling
- Treat boolean props that switch large component trees (\`isEditing\`, \`isThread\`, \`hideAttachments\`) as a composition smell; prefer separate composed components for distinct use cases
- For complex reusable UI, prefer compound components with provider-scoped state/actions over monolithic components with many optional props
- Use Context for scoped component families as well as truly global state, when it defines a local interface consumed by descendants
- Render JSX directly for UI variation; avoid config-array mini-frameworks unless the config is real domain data
- Lift the provider boundary when sibling or external controls need access to the same state/actions
- Use \`flushSync\` when you need to read the DOM synchronously after a state update`,Bi=`# Motion Dev Animations

> **Motion.dev** — 10M+ downloads/month, successor to Framer Motion. \`npm install motion\`

## When to Use

✅ React 19+/Next.js 15+/Svelte 5+/Astro 4+ animation implementation
✅ Scroll effects (parallax, reveal), gestures (hover, drag, tap), layout animations
✅ Hero sections, cards, micro-interactions requiring 60fps+ performance
❌ CSS-only transitions (use native \`transition\` property instead)
❌ Vue projects (use \`motion-v\` package — different API)
❌ Complex SVG/Canvas animations (GSAP is better suited)

## Animation Pattern Decision Tree

\`\`\`
What should animate?

├─ ENTRANCE (page load, mount)
│   → initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}}
│   → duration: 0.6–0.8s, ease: [0.22, 1, 0.36, 1]
│   → stagger: 0.1–0.2s between elements
│
├─ GESTURE (hover, tap, drag)
│   → whileHover={{scale: 1.05}}, whileTap={{scale: 0.95}}
│   → Spring physics (stiffness: 300–400, damping: 20)
│   → Instant response (no duration on spring)
│
├─ SCROLL (reveal, parallax)
│   → whileInView + viewport={{once: true, amount: 0.3}}
│   → OR useScroll + useTransform for parallax
│   → transform/opacity only for performance
│
└─ LAYOUT (reorder, expand, shared element)
    → layout prop (auto FLIP animation)
    → layoutId="id" for shared element morphing between screens
\`\`\`

## API Quick Reference

| Component/Hook | Usage | When |
|----------------|-------|------|
| \`motion.div\` | \`<motion.div animate={{x: 100}}>\` | Basic animations |
| \`whileHover\` | \`whileHover={{scale: 1.05}}\` | Hover states (0.2–0.3s) |
| \`whileTap\` | \`whileTap={{scale: 0.95}}\` | Click feedback |
| \`whileInView\` | \`whileInView={{opacity: 1}}\` | Scroll reveal |
| \`drag\` | \`drag="x"\` + \`dragConstraints\` | Draggable elements |
| \`layout\` | \`<motion.div layout />\` | Auto FLIP animation |
| \`layoutId\` | \`layoutId="hero"\` | Shared element transitions |
| \`useScroll\` | Track scroll progress | Parallax, progress bars |
| \`useTransform\` | Map scroll values | Scroll-linked effects |
| \`useSpring\` | Spring physics on a value | Smooth follower effects |
| \`AnimatePresence\` | Wrap conditional renders | Exit animations |

## Import

\`\`\`tsx
// React / Next.js
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from 'motion/react'
\`\`\`

## Common Patterns (copy-paste ready)

\`\`\`tsx
// Fade up entrance
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
/>

// Hover card lift
<motion.div
  whileHover={{ y: -8, boxShadow: "0 20px 40px rgba(0,0,0,0.12)" }}
  transition={{ type: "spring", stiffness: 300, damping: 20 }}
/>

// Scroll reveal
<motion.div
  initial={{ opacity: 0, y: 50 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.3 }}
/>

// Staggered list
const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
}
const item = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }
<motion.ul variants={container} initial="hidden" animate="visible">
  {items.map(i => <motion.li key={i} variants={item}>{i}</motion.li>)}
</motion.ul>

// Exit animation
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    />
  )}
</AnimatePresence>

// Tab indicator (shared layout)
{tabs.map(tab => (
  <button key={tab} onClick={() => setActive(tab)} style={{ position: 'relative' }}>
    {tab}
    {active === tab && (
      <motion.div
        layoutId="tab-indicator"
        style={{ position: 'absolute', inset: 0, background: 'var(--color-accent)', borderRadius: 6, zIndex: -1 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      />
    )}
  </button>
))}
\`\`\`

## Quality Standards

| Category | Requirement |
|----------|-------------|
| Performance | ≥60fps — animate \`transform\`/\`opacity\` only; never width/height/top/left |
| Bundle | motion adds ~30–50KB; worth it for spring physics and FLIP |
| Accessibility | Always wrap in \`@media (prefers-reduced-motion: no-preference)\` or check via \`useReducedMotion()\` |
| Exit timing | ~65% of enter duration (feels more responsive) |
| Spring feel | stiffness 300–400, damping 20 for snappy; lower stiffness for bouncier |

## Design Principles

- **Purposeful** — every animation serves a function: reveals hierarchy, confirms action, guides attention
- **Natural physics** — prefer spring transitions over tween; avoid linear easing for UI
- **Elegant restraint** — 1–2 animated elements per view; staggered reveals beat simultaneous motion
- **Accessible** — always support \`prefers-reduced-motion\`; provide instant fallback`,Fi=`# Web Performance Optimization

## Performance Budget

| Resource | Budget | Rationale |
|----------|--------|-----------|
| Total page weight | < 1.5 MB | 3G loads in ~4s |
| JavaScript (compressed) | < 300 KB | Parsing + execution time |
| CSS (compressed) | < 100 KB | Render blocking |
| Images (above-fold) | < 500 KB | LCP impact |
| Fonts | < 100 KB | FOIT/FOUT prevention |

## Resource Loading

\`\`\`html
<!-- Preconnect to required origins -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://cdn.example.com" crossorigin>

<!-- Preload LCP image -->
<link rel="preload" href="/hero.webp" as="image" fetchpriority="high">

<!-- Preload critical font -->
<link rel="preload" href="/font.woff2" as="font" type="font/woff2" crossorigin>
\`\`\`

## JavaScript Optimization

\`\`\`tsx
// Route-based code splitting
const Dashboard = lazy(() => import('./Dashboard'))
const HeavyChart = lazy(() => import('./HeavyChart'))

// Feature-based splitting
if (user.isPremium) {
  const { init } = await import('./PremiumFeatures')
  init()
}

// Tree shaking — import only what you need
import debounce from 'lodash/debounce'   // ✅ single function
import _ from 'lodash'                    // ❌ entire library
\`\`\`

## Image Optimization

\`\`\`html
<!-- Above-fold LCP image: eager, high priority, explicit dimensions -->
<img src="hero.webp" fetchpriority="high" loading="eager" decoding="sync"
     width="1200" height="600" alt="Hero">

<!-- Below-fold: lazy load -->
<img src="product.webp" loading="lazy" decoding="async"
     width="800" height="600" alt="Product">
\`\`\`

**Format selection:**
- AVIF (92%+ browser support) — best compression for photos
- WebP (97%+ support) — safe default fallback
- SVG — icons, logos, illustrations (scales cleanly)
- Always declare \`width\`/\`height\` or \`aspect-ratio\` to prevent CLS

## Font Optimization

\`\`\`css
@font-face {
  font-family: 'Custom Font';
  src: url('/fonts/custom.woff2') format('woff2');
  font-display: swap;           /* prevents invisible text (FOIT) */
  unicode-range: U+0000-00FF;  /* subset to Latin only */
}

/* Variable fonts: one file for all weights */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter-Variable.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-display: swap;
}
\`\`\`

## Runtime Performance

\`\`\`javascript
// Avoid layout thrashing — batch reads then writes
const heights = elements.map(el => el.offsetHeight)       // all reads
elements.forEach((el, i) => { el.style.height = heights[i] + 10 + 'px' })  // all writes

// Debounce high-frequency events
window.addEventListener('scroll', debounce(handleScroll, 100))
window.addEventListener('resize', debounce(handleResize, 150))

// Virtualize long lists (>100 items)
// react-window, or CSS content-visibility:
.virtual-list { content-visibility: auto; contain-intrinsic-size: 0 50px; }
\`\`\`

## React-Specific

\`\`\`tsx
// Memoize expensive child components
const MemoizedExpensive = React.memo(ExpensiveComponent)

// Defer expensive state updates to keep UI responsive
const [isPending, startTransition] = useTransition()
startTransition(() => setExpensiveState(newValue))

// Avoid unnecessary re-renders: stable references
const handleClick = useCallback(() => { ... }, [deps])
const computed = useMemo(() => expensiveCalc(data), [data])
\`\`\`

## Caching Headers

\`\`\`
# HTML (always revalidate)
Cache-Control: no-cache, must-revalidate

# Static assets with content hash (immutable)
Cache-Control: public, max-age=31536000, immutable

# API responses
Cache-Control: private, max-age=0, must-revalidate
\`\`\`

## Key Metrics

| Metric | Good | Tool |
|--------|------|------|
| LCP | < 2.5s | Lighthouse, CrUX |
| FCP | < 1.8s | Lighthouse |
| TBT | < 200ms | Lighthouse |
| TTI | < 3.8s | Lighthouse |`,Ui=`# Core Web Vitals

| Metric | Measures | Good | Poor |
|--------|----------|------|------|
| **LCP** | Loading | ≤ 2.5s | > 4s |
| **INP** | Interactivity | ≤ 200ms | > 500ms |
| **CLS** | Visual Stability | ≤ 0.1 | > 0.25 |

Google measures at the **75th percentile** of all page visits.

## LCP — Largest Contentful Paint

Usually the hero image, large heading, or background image. Common fixes:

\`\`\`html
<!-- ❌ LCP image discovered late, no priority -->
<img src="/hero.jpg" alt="Hero">

<!-- ✅ Preloaded with high priority + dimensions -->
<link rel="preload" href="/hero.webp" as="image" fetchpriority="high">
<img src="/hero.webp" alt="Hero" fetchpriority="high"
     loading="eager" decoding="sync" width="1200" height="600">
\`\`\`

\`\`\`tsx
// ❌ Content JS-rendered — LCP element not in initial HTML
useEffect(() => { fetch('/api/hero').then(setHeroText) }, [])

// ✅ SSR / SSG — content in initial HTML; LCP is instant
\`\`\`

**LCP checklist:**
- [ ] TTFB < 800ms (CDN, edge caching)
- [ ] LCP image preloaded with \`fetchpriority="high"\`
- [ ] LCP element in initial HTML (not JS-rendered)
- [ ] Critical CSS inlined or loaded early (< 14KB)
- [ ] No render-blocking JS in \`<head>\`
- [ ] Fonts use \`font-display: swap\`

**Next.js shortcut:**
\`\`\`tsx
import Image from 'next/image'
<Image src="/hero.jpg" priority fill alt="Hero" />
\`\`\`

## INP — Interaction to Next Paint

Total INP = **Input Delay** + **Processing Time** + **Presentation Delay**
Target each phase: <50ms / <100ms / <50ms

\`\`\`javascript
// ❌ Heavy handler — blocks main thread for entire duration
button.addEventListener('click', () => {
  const result = calculateComplexThing()  // slow
  updateUI(result)
})

// ✅ Immediate visual feedback, then yield before heavy work
button.addEventListener('click', async () => {
  button.classList.add('loading')  // instant visual feedback (<16ms)

  // Yield so browser can paint the loading state
  if ('scheduler' in window && 'yield' in scheduler) {
    await scheduler.yield()
  } else {
    await new Promise(r => setTimeout(r, 0))
  }

  const result = calculateComplexThing()
  updateUI(result)
  button.classList.remove('loading')
})
\`\`\`

\`\`\`tsx
// ❌ Entire tree re-renders on count change
function App() {
  const [count, setCount] = useState(0)
  return <div><Counter count={count} /><ExpensiveComponent /></div>
}

// ✅ Memoize expensive components to skip re-renders
const MemoizedExpensive = React.memo(ExpensiveComponent)

// ✅ useTransition for non-urgent state updates
const [isPending, startTransition] = useTransition()
startTransition(() => setExpensiveFilterState(value))
\`\`\`

**INP checklist:**
- [ ] No tasks > 50ms on main thread
- [ ] Visual feedback provided within 80ms of interaction
- [ ] Heavy work yielded with \`scheduler.yield()\` or deferred
- [ ] Third-party scripts load \`async\`/\`defer\`
- [ ] Input handlers debounced where appropriate

## CLS — Cumulative Layout Shift

CLS formula: impact fraction × distance fraction. Any visible element moving = bad.

\`\`\`html
<!-- ❌ Causes layout shift when image loads -->
<img src="photo.jpg" alt="Photo">

<!-- ✅ Space reserved — no shift -->
<img src="photo.jpg" alt="Photo" width="800" height="600">
\`\`\`

\`\`\`css
/* ✅ Or use aspect-ratio */
img { aspect-ratio: 4/3; width: 100%; }

/* ❌ Animating layout properties → CLS */
.card { transition: height 0.3s; }

/* ✅ Use transform instead (compositor only, no layout) */
.card { transition: transform 0.3s; }
.card.expanded { transform: scale(1.05); }
\`\`\`

\`\`\`css
/* ✅ Fonts: size-adjusted fallback prevents FOUT layout shift */
@font-face {
  font-family: 'Custom';
  src: url('/custom.woff2') format('woff2');
  font-display: optional;  /* no shift: hides if font loads late */
}
\`\`\`

**CLS checklist:**
- [ ] All images/videos have \`width\`/\`height\` or \`aspect-ratio\`
- [ ] Ads/embeds have reserved \`min-height\` containers
- [ ] Fonts use \`font-display: optional\` or size-matched fallback metrics
- [ ] Dynamic content inserted below viewport, not above existing content
- [ ] Animations use only \`transform\`/\`opacity\`

## Measuring

\`\`\`javascript
import { onLCP, onINP, onCLS } from 'web-vitals'

onLCP(({ value, rating }) => console.log('LCP', value, rating))
onINP(({ value, rating }) => console.log('INP', value, rating))
onCLS(({ value, rating }) => console.log('CLS', value, rating))
\`\`\`

\`\`\`bash
npx lighthouse https://example.com --output html --output-path report.html
\`\`\``,Wi="# shadcn/ui — Component Patterns & Theming\n\nshadcn/ui is a collection of accessible, customizable React components built on Radix UI primitives and Tailwind CSS. Components live as source files in the project — write them directly, don't import from a package.\n\n## Key Concept\n\n**Not a package you import.** Components are source code in `components/ui/`. Write them directly into the project as .tsx files. They depend on Radix UI primitives (available via esm.sh) and use CSS variables for theming.\n\n## Required Utilities\n\nEvery project using shadcn components needs the `cn()` helper:\n\n```ts\n// lib/utils.ts\nimport { clsx, type ClassValue } from 'clsx'\nimport { twMerge } from 'tailwind-merge'\n\nexport function cn(...inputs: ClassValue[]) {\n  return twMerge(clsx(inputs))\n}\n```\n\nDependencies: `clsx`, `tailwind-merge`, `class-variance-authority` (cva), `radix-ui` (or individual `@radix-ui/react-*` packages).\n\n## Theming — CSS Variables\n\nDefine in `src/index.css` or `globals.css`. shadcn uses semantic color tokens, never raw hex in components:\n\n```css\n:root {\n  --background: oklch(1 0 0);\n  --foreground: oklch(0.145 0 0);\n  --card: oklch(1 0 0);\n  --card-foreground: oklch(0.145 0 0);\n  --primary: oklch(0.205 0 0);\n  --primary-foreground: oklch(0.985 0 0);\n  --secondary: oklch(0.97 0 0);\n  --secondary-foreground: oklch(0.205 0 0);\n  --muted: oklch(0.97 0 0);\n  --muted-foreground: oklch(0.556 0 0);\n  --accent: oklch(0.97 0 0);\n  --accent-foreground: oklch(0.205 0 0);\n  --destructive: oklch(0.577 0.245 27.325);\n  --destructive-foreground: oklch(0.985 0 0);\n  --border: oklch(0.922 0 0);\n  --input: oklch(0.922 0 0);\n  --ring: oklch(0.708 0 0);\n  --radius: 0.625rem;\n}\n\n.dark {\n  --background: oklch(0.145 0 0);\n  --foreground: oklch(0.985 0 0);\n  --card: oklch(0.205 0 0);\n  --card-foreground: oklch(0.985 0 0);\n  --primary: oklch(0.922 0 0);\n  --primary-foreground: oklch(0.205 0 0);\n  --secondary: oklch(0.269 0 0);\n  --secondary-foreground: oklch(0.985 0 0);\n  --muted: oklch(0.269 0 0);\n  --muted-foreground: oklch(0.708 0 0);\n  --accent: oklch(0.269 0 0);\n  --accent-foreground: oklch(0.985 0 0);\n  --destructive: oklch(0.396 0.141 25.723);\n  --destructive-foreground: oklch(0.985 0 0);\n  --border: oklch(0.269 0 0);\n  --input: oklch(0.269 0 0);\n  --ring: oklch(0.488 0.243 264.376);\n}\n```\n\nApply to elements using Tailwind classes that map to these tokens: `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border`, etc.\n\n## Most Common Components\n\n| Component | Use Case |\n|-----------|----------|\n| `button` | Actions, form submission |\n| `card` | Content containers |\n| `dialog` | Modals, confirmation prompts |\n| `alert-dialog` | Destructive confirmations (use this, not dialog) |\n| `input` / `textarea` | Form fields |\n| `select` | Dropdowns |\n| `table` | Data display |\n| `tabs` | View switching |\n| `command` | Command palette (Cmd+K) |\n| `dropdown-menu` | Context menus |\n| `popover` | Floating content |\n| `tooltip` | Hover hints |\n| `badge` | Status indicators |\n| `avatar` | User profile images |\n| `scroll-area` | Scrollable containers |\n| `sheet` | Slide-out panels |\n| `skeleton` | Loading placeholders |\n| `separator` | Visual dividers |\n| `label` | Form labels |\n| `alert` | Inline notifications |\n\n## Design Direction\n\n### Default aesthetic\n\n- Prefer `new-york` style (sharp radius, subtle shadows) for product, dashboard, and admin surfaces\n- Default to dark mode for dashboards, AI apps, developer-facing products; light for content/editorial\n- Use Geist Sans for interface text, Geist Mono for code/metrics/IDs/timestamps\n- Base palette: zinc, neutral, or slate — one accent color via `--primary`\n- Build surfaces from semantic tokens: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`\n- No ad-hoc hex values — semantic tokens only\n- Icons: Lucide at `h-4 w-4` or `h-5 w-5`; keep them quiet and consistent\n\n### Composition recipes\n\n| Use case | Components | Why |\n|----------|------------|-----|\n| Settings page | `Tabs` + `Card` + form fields | Clear grouping with predictable save flows |\n| Data dashboard | `Card` + `Badge` + `Table` + `DropdownMenu` | Summary, status, dense data, row actions |\n| CRUD table | `Table` + `DropdownMenu` + `Sheet` + `AlertDialog` | Browse, act, edit, destructive confirmation |\n| Auth screen | `Card` + `Label` + `Input` + `Button` + `Alert` | Focused entry with proper error treatment |\n| Global search | `Command` + `Dialog` | Fast keyboard-first discovery |\n| Mobile nav | `Sheet` + `Button` + `Separator` | Compact navigation shell |\n| Detail page | header + `Badge` + `Separator` + `Card` | Hierarchy, metadata, supporting content |\n| Filters (desktop) | `Card` sidebar + `Select` | Persistent filter panel |\n| Filters (mobile) | `Sheet` + `Select` | Collapsible mobile controls |\n| Empty/loading/error | `Card` + `Skeleton` + `Alert` | Designed non-happy paths |\n\n### Anti-patterns to avoid\n\n- Raw `button` / `input` / `select` / `div` when shadcn components exist\n- Repeated `div rounded-xl border p-6` instead of proper `Card`/`Sheet`/`Dialog`\n- Multiple accent colors fighting each other\n- Nested cards inside cards inside cards\n- Large gradient backgrounds and glassmorphism on every surface\n- Mixing arbitrary spacing and radius values\n- Using `Dialog` for destructive confirmation instead of `AlertDialog`\n- Shipping empty/loading/error states without design treatment\n- Ad-hoc Tailwind palette classes (`bg-gray-900`) instead of semantic tokens (`bg-background`)\n\n## Component Gotchas\n\n### Avatar Has No `size` Prop\n\n```tsx\n// WRONG\n<Avatar size=\"lg\" />\n\n// CORRECT\n<Avatar className=\"h-12 w-12\">\n  <AvatarImage src={user.image} />\n  <AvatarFallback>JD</AvatarFallback>\n</Avatar>\n```\n\nMost shadcn components use Tailwind classes for sizing, not variant props.\n\n### TooltipProvider Required at Root\n\n```tsx\nimport { TooltipProvider } from '@/components/ui/tooltip'\n\nexport default function App() {\n  return (\n    <TooltipProvider>\n      {/* rest of app */}\n    </TooltipProvider>\n  )\n}\n```\n\n### Extending Components\n\nSince you own the source, extend directly with `cva`:\n\n```tsx\n// components/ui/button.tsx\nconst buttonVariants = cva('...', {\n  variants: {\n    variant: {\n      default: '...',\n      destructive: '...',\n      success: 'bg-green-600 text-white hover:bg-green-700',\n    },\n  },\n})\n```\n\n### Radius Tokens\n\n```css\n--radius: 0.625rem;\n--radius-sm: calc(var(--radius) * 0.75);\n--radius-md: calc(var(--radius) * 0.875);\n--radius-lg: var(--radius);\n--radius-xl: calc(var(--radius) * 1.5);\n```\n\nUse `rounded-[--radius-md]` etc. to stay consistent with the design system.\n",Hi=`# Karpathy Guidelines — Coding Discipline

Behavioral guidelines to reduce common LLM coding mistakes, derived from Andrej Karpathy's observations on LLM coding pitfalls. These bias toward caution over speed — use judgment on trivial tasks.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria before writing a line.**

Transform tasks into verifiable outcomes:
- "Add a contact form" → "Form renders, validates required fields, shows success on submit"
- "Fix the broken layout" → "Layout matches the screenshot at 390px and 1280px"
- "Add dark mode" → "All text passes 4.5:1 contrast in both themes; no hardcoded colors remain"

For multi-step work, state a brief plan first:
\`\`\`
1. [Step] → verify: [what compile / visual check confirms it]
2. [Step] → verify: [what compile / visual check confirms it]
3. [Step] → verify: [what compile / visual check confirms it]
\`\`\`

Strong success criteria let you work independently. Weak criteria ("make it look good") require constant clarification.
`,$t=[{name:"compile",description:'Build the project AND run it to check for both build errors and runtime errors. This bundles the code, then actually renders the app in a hidden browser frame and reports any uncaught errors, broken references (e.g. an undefined variable), or render crashes — things a plain transpile cannot catch. Call this after a coherent batch of writes/edits and always before done. If errors are returned, read the affected files and fix them. A "build succeeded but crashes at runtime" result is a FAILURE — the app does not work yet. Do NOT call compile again if no files were changed since the last passing compile — the result will be identical.',input_schema:{type:"object",properties:{},additionalProperties:!1}},{name:"set_schema",description:'Declare the database tables this app needs (only available when a Supabase backend is connected). Provide tables with columns and an access level; OpenThorn creates/updates them safely with row-level security enabled — you do NOT write SQL. id (uuid), user_id (the signed-in user), and created_at are added automatically to every table; do not declare them. access: "owner" = each row private to its creator (todos, notes); "public_read" = anyone can read, only the owner writes (blog posts); "authenticated" = any signed-in user can read, only the owner writes. Calling again is safe and additive — it never drops columns or data.',input_schema:{type:"object",properties:{tables:{type:"array",description:"The tables to create or extend.",items:{type:"object",properties:{name:{type:"string",description:'snake_case table name, e.g. "todos".'},access:{type:"string",enum:["owner","public_read","authenticated"],description:"Row access policy."},columns:{type:"array",items:{type:"object",properties:{name:{type:"string"},type:{type:"string",enum:["text","integer","numeric","boolean","timestamptz","date","uuid","jsonb"]},nullable:{type:"boolean"},default:{description:"Optional default (string, number, or boolean)."}},required:["name","type"],additionalProperties:!1}}},required:["name","access","columns"],additionalProperties:!1}}},required:["tables"],additionalProperties:!1}},{name:"delete_file",description:"Delete a file from the project. Use this to remove files that are no longer needed — for example, leftover boilerplate or components from a previous version that nothing imports anymore. Keeping dead files around clutters the project and confuses future edits. You cannot delete src/App.tsx (the entry point) — overwrite it with write_file instead. After deleting, compile to confirm nothing still imported the file.",input_schema:{type:"object",properties:{path:{type:"string",description:'The file path to delete, e.g. "src/components/OldHero.tsx".'}},required:["path"],additionalProperties:!1}},{name:"done",description:"Mark the project as complete. Only call this when your most recent compile passed BOTH the build and the runtime check (no errors, the app renders) and every requested feature is implemented and working. There is no separate reviewer after this — you are responsible for the result, so compile right before finishing and self-check every requested feature. done is VERIFIED: it is rejected if files changed since the last passing compile, if a stylesheet exists that nothing imports (the app would render unstyled), if the app's buttons/inputs throw errors when actually exercised, or if the rendered layout is measured to have PROBLEMs (mobile overflow, overlapping controls, clipped text, off-screen buttons). For visual apps, done may also run screenshot review. If rejected, fix the reported cause and call done again. Include a brief summary of what was built and a short descriptive title (3-6 words).",input_schema:{type:"object",properties:{summary:{type:"string",description:"A brief summary of what the completed project includes."},title:{type:"string",description:'A short, descriptive title for the project (3-6 words). Make it specific to what was built — not generic like "Website" or "Project".'}},required:["summary"],additionalProperties:!1}},{name:"edit_file",description:"Make a targeted edit to an existing file by replacing old_string with new_string. Match the existing text as closely as you can (copy it from a recent read_file); indentation whitespace is matched tolerantly, but the old_string must still be unique. Use this for small, focused changes. If an edit keeps failing to match, read the file again or use write_file to replace the whole file instead of retrying the same edit.",input_schema:{type:"object",properties:{path:{type:"string",description:"The file path to edit."},old_string:{type:"string",description:"The exact text to replace. Must be unique in the file."},new_string:{type:"string",description:"The replacement text."}},required:["path","old_string","new_string"],additionalProperties:!1}},{name:"list_files",description:"List all files currently in the virtual project. Use this to understand the current state of the project before making changes.",input_schema:{type:"object",properties:{},additionalProperties:!1}},{name:"load_skill",description:"Load a skill to get deep domain knowledge BEFORE working on a task in that domain. Call this proactively at the very start of a task — it is your normal first move on any real build, not a last resort. Most UI work should load frontend-design and ui-ux-pro-max; animation work adds motion-dev-animations; perf work loads performance/core-web-vitals; shadcn/ui component work loads shadcn; coding discipline loads karpathy-guidelines. Loading is cheap; skipping it produces generic output. The full skill body is returned as the result.",input_schema:{type:"object",properties:{skill_id:{type:"string",enum:["core-web-vitals","frontend-design","karpathy-guidelines","motion-dev-animations","performance","react-best-practices","shadcn","ui-ux-pro-max"],description:"The skill to load."}},required:["skill_id"],additionalProperties:!1}},{name:"multi_edit",description:"Apply several edits to a SINGLE file in one atomic call. Each edit is an {old_string, new_string} pair, applied in order — later edits see the result of earlier ones. Prefer this over many separate edit_file calls when changing one file in multiple places: it is faster and either ALL edits apply or NONE do (if any old_string is not found, the file is left unchanged and you are told which edit failed). Same matching rules as edit_file: each old_string should be unique; indentation is matched tolerantly. Example: rename a variable in 3 spots, or update imports plus two usages together.",input_schema:{type:"object",properties:{path:{type:"string",description:"The file path to edit."},edits:{type:"array",description:"The edits to apply, in order.",items:{type:"object",properties:{old_string:{type:"string",description:"The exact text to replace."},new_string:{type:"string",description:"The replacement text."}},required:["old_string","new_string"],additionalProperties:!1}}},required:["path","edits"],additionalProperties:!1}},{name:"read_file",description:"Read the content of a file in the virtual project. Use this before editing a file or to understand the current implementation. Do NOT re-read a file you just successfully wrote or edited — the write/edit tool already confirms the change was applied. For large files, specify offset and limit to read a range of lines.",input_schema:{type:"object",properties:{path:{type:"string",description:'The file path to read, e.g. "src/App.tsx" or "src/styles/theme.css".'},offset:{type:"integer",description:"Line number to start reading from (1-based). Defaults to 1."},limit:{type:"integer",description:"Maximum number of lines to read. Defaults to 500. If the file has more lines, the output is truncated with a note."}},required:["path"],additionalProperties:!1}},{name:"search_files",description:"Search across all project files using a regex pattern. Returns matching lines with file paths and line numbers. Use this to find references, imports, function usages, or any pattern without reading every file individually.",input_schema:{type:"object",properties:{pattern:{type:"string",description:"The regex pattern to search for."},glob:{type:"string",description:'Optional glob pattern to filter files. A pattern with no slash matches by filename anywhere in the tree, e.g. "*.tsx" or "theme.css". Use a path like "src/components/**" to scope to a directory.'},output_mode:{type:"string",enum:["content","files_with_matches","count"],description:'Output mode (default: "content").'},context_lines:{type:"integer",description:"Number of context lines around each match (default: 0)."}},required:["pattern"],additionalProperties:!1}},{name:"think",description:"Think through a design decision, architecture choice, or implementation approach. Use this before writing any code to reason about structure, colors, typography, component boundaries, and responsive strategy.",input_schema:{type:"object",properties:{thought:{type:"string",description:"Your reasoning about the design decision or approach."}},required:["thought"],additionalProperties:!1}},{name:"write_file",description:'Create a new file or completely replace an existing one with the full content you provide. Use this for new files or when rewriting most of a file. For small changes to an existing file, prefer edit_file (one spot) or multi_edit (several spots) so you do not risk dropping working code. On refine tasks, do not overwrite a long existing file just to add one mechanic, prop, button, style, or handler; patch the specific locations. Always provide complete, valid code — never partial snippets or "// rest unchanged" placeholders.',input_schema:{type:"object",properties:{path:{type:"string",description:'The file path, e.g. "src/components/Hero.tsx". Must be under src/.'},language:{type:"string",enum:["tsx","ts","jsx","js","css","json"],description:"The file language/type."},code:{type:"string",description:"The complete file content. Must be valid code, not empty."}},required:["path","language","code"],additionalProperties:!1}},{name:"set_title",description:"Set the project title. Call this once at the very start of a new project (create mode) with a concise, descriptive 3-6 word title. Do not call it during refine mode.",input_schema:{type:"object",properties:{title:{type:"string",description:"A short, descriptive title for the project (3-6 words)."}},required:["title"],additionalProperties:!1}}],qi=new Set(["think","set_title","load_skill","list_files","read_file","write_file","edit_file","set_schema","compile","done"]),Gi=new Set(["think","load_skill","list_files","read_file","write_file","edit_file","multi_edit","set_schema","compile","done"]),zi=/\b(delete|remove|clean|cleanup|refactor|rename|replace|search|find|where|unused|existing|multiple|several)\b/i;function Vi(e){const t=i=>e.hasBackend?i:i.filter(r=>r.name!=="set_schema");if(e.smallRefine){const i=$t.filter(r=>Gi.has(r.name));return{tools:t(i),expanded:!1}}if(e.mode==="refine"||!e.isNewProject||zi.test(e.prompt))return{tools:t($t),expanded:!0};const n=$t.filter(i=>qi.has(i.name));return{tools:t(n),expanded:!1}}const Ki=`<system-reminder>
For this build the tool set is: think, set_title, load_skill, list_files, read_file, write_file, edit_file, compile, done. The multi_edit, delete_file, and search_files tools are not loaded for this task — write_file and edit_file cover everything needed. Do not attempt to call them. (load_skill IS available — load the relevant skill before you start building, per <available-skills>.)
</system-reminder>`,Ji=`<system-reminder>
This is a small, self-contained change. The tool set is: think, load_skill, list_files, read_file, write_file, edit_file, multi_edit, compile, done. set_title, delete_file, and search_files are NOT loaded — don't call them. Go straight to the edit, compile once, then done. If the change is visual/design work (styling, layout, look-and-feel), load the relevant design skill first (frontend-design or ui-ux-pro-max) — a one-line CSS tweak still benefits from getting it right the first time.
</system-reminder>`,Yi=`<system-reminder>
A Supabase backend is connected, so you can build a real app with saved data and user accounts.
- Schema: declare tables with the set_schema tool (RLS is automatic; id, user_id, and created_at are added to every table — don't declare them). access per table: "owner" (row private to its creator), "public_read" (everyone reads, owner writes), "authenticated" (signed-in users read, owner writes). Call set_schema BEFORE writing code that queries a table; calling it again is safe and additive.
- Data + auth in the app: import the ready-made client — import { db, auth } from '@openthorn/db'. Query with db.from('todos').select(), db.from('todos').insert({ title }), db.from('todos').update({ done: true }).eq('id', id), etc. Do NOT set user_id yourself — it defaults to the signed-in user. Auth: auth.signUp({ email, password }), auth.signInWithPassword({ email, password }), auth.signOut(), and auth.onAuthStateChange((_e, session) => …). Email confirmation is disabled for this backend, so signUp signs the user in immediately and returns a session — route straight into the app on success; do NOT build a "check your email to confirm" screen. Build real sign-up / sign-in / sign-out UI and show a signed-out state when there is no session. NEVER hardcode Supabase keys or call createClient yourself — always use @openthorn/db.
</system-reminder>`,Xi=`<system-reminder>
This project has NO Supabase backend connected, so there is no real database, saved data, or user accounts available. The set_schema tool and @openthorn/db are NOT available here.
- If the user asks for anything that needs a real backend — a database, saved/persisted data that survives reload, user accounts, sign-up / login, multi-user or shared data — DON'T silently fake it. First tell them plainly that no database is connected, and that they can activate a real one by clicking the "Backend" button (top of the builder) to connect Supabase.
- After saying that, offer to build a front-end-only demo version in the meantime using in-browser state (React state / localStorage). Only build the localStorage demo if they want it; make clear that this data is per-browser and not a real shared database.
- Never import @openthorn/db, call set_schema, or hardcode any Supabase keys — none of that works without a connected backend.
</system-reminder>`,rn=16e3;function Zi(e){if(e.length<=rn)return e;const t=e.length-rn;return e.slice(0,rn)+`

[... ${t} more characters truncated. Narrow your request — read a specific line range, use search_files, or fix the first errors and recompile.]`}const Qi={think:"read",load_skill:"read",list_files:"read",read_file:"read",search_files:"read",set_title:"read",write_file:"write",edit_file:"write",multi_edit:"write",delete_file:"write",set_schema:"write",compile:"compile",done:"done"},er=Gs.map(e=>`  - ${e.name} — ${e.description}`).join(`
`),tr=`You are OpenThorn, an expert frontend engineer and product designer. You build complete, polished, production-quality web apps and sites with React, TypeScript, and CSS — the kind of work a senior engineer would be proud to ship.

<persona>
Methodical, design-conscious, precise. You think before you act, read before you edit, and verify after coherent batches instead of after every tiny patch. You sweat the details: spacing, hierarchy, states, responsiveness. You never leave placeholders, TODOs, or half-built features. You finish things.
</persona>

<conversation-vs-build>
Not every message is a build request. Before doing anything, classify the user's message:
- **Conversation** — a greeting ("hey", "hi"), casual remark, thanks, or a question that asks for information rather than changes ("what is this application?", "how does the login work?", "what can you do?"). Respond in plain text and call NO file-modifying tools. To answer questions about the existing project you may use read-only tools (list_files, read_file, search_files) first, then answer in text. Do not create files, do not call set_title, do not call compile or done. Ending your response with text and no tool calls ends the turn — that is the correct way to finish a conversational reply.
- **Build request** — asks you to create, add, change, fix, or remove something. Follow <approach> below, and make sure your responses include tool calls until the work is verified and done.
If a message is ambiguous, ask a clarifying question in plain text instead of guessing and building something the user never asked for.
</conversation-vs-build>

<honesty>
Never claim the project "works", "compiles", or is "done" unless the compile tool actually returned success for the CURRENT files. compile builds AND runs the app — a "build succeeded but crashes at runtime" result means it does NOT work. A clean transpile is not proof it runs; only the runtime check is. If your last change has not been compiled, compile before making any success claim. Report what the tool actually returned — never assume or fabricate success. Show evidence (what the tool returned), don't just assert it.
</honesty>

<objectivity>
Prioritize technical accuracy and the best outcome for the product over agreeing with the user. If a request would produce a worse result — an inaccessible color, a broken layout, an anti-pattern, a feature that contradicts something already built — say so plainly and implement the better approach (or ask, if the trade-off is genuinely the user's call). Don't open with flattery ("Great idea!"), don't validate a choice you can see is wrong, and don't hedge a clear technical fact. Useful and correct beats agreeable.
</objectivity>

<persistence>
Once you've classified a message as a build request, keep working until it is fully implemented and verified — do not stop and hand back half-done. Don't ask permission to take obvious next steps ("Should I add the footer too?") or narrate that you'll continue ("Let me know if you want me to keep going") — just do the work the request implies, end to end, then finish with done. The only legitimate reasons to stop early are: a genuine blocker you cannot resolve, or a request so ambiguous that guessing would build the wrong thing — in which case ask one focused question instead of guessing. Resolve uncertainty yourself wherever a reasonable default exists; reserve questions for decisions only the user can make. (This is about not abandoning a task mid-flight — it is NOT license to keep polishing after the work is done and verified; the "stop when it works" rule still holds.)
</persistence>

<environment>
Stack: React 18+, automatic JSX, TypeScript, CSS with custom properties.
Entry: src/App.tsx renders into #root (the entry wrapper is provided — just default-export App).
Packages available: react, react-dom, react-router-dom, PLUS this curated allowlist:
${er}
Use these freely where they help (real icons via lucide-react, motion via framer-motion, charts via recharts). Do not import any npm package outside this list, and do not add CDN fonts or icon packs.
**Real images — FREE-TO-USE ONLY:** when the design needs photos (hero, gallery, product/food shots, avatars, backgrounds), use REAL photographs via direct https URLs, but ONLY from these free-to-use hosts (allowed in preview and on the deployed site):
  - Unsplash (Unsplash License — free, no attribution): \`https://images.unsplash.com/photo-...?auto=format&fit=crop&w=1200&q=80\` (size via the w= query param)
  - Picsum / Lorem Picsum (free, Unsplash-sourced): \`https://picsum.photos/seed/<word>/1200/800\` — stable per seed, good when you don't need a specific subject
  - placehold.co (generated placeholders): \`https://placehold.co/1200x800\`
  NEVER hotlink an image from any other site (Google Images, a brand/company site, stock-photo watermarked previews, social media, news sites, etc.) — those are copyrighted and not licensed for reuse. Only the three hosts above are permitted; the done check rejects images from any other host.
  Always set explicit width/height (or an aspect-ratio container) so images don't cause layout shift, add descriptive alt text, use object-fit: cover, and add loading="lazy" for below-the-fold images. Do NOT fake a photograph by hand-drawing it as an SVG — use a real image URL. Keep using inline SVG for icons, logos, and decorative shapes.
Files: one default export per file, under src/ (src/components/, src/pages/). Put the design system — tokens (custom properties), resets, base typography, shared utilities — in src/styles/theme.css. Keep page- and component-specific styles in their OWN stylesheet next to the file that uses them (e.g. src/pages/Menu.css imported by src/pages/Menu.tsx), not all piled into theme.css. A 1000+ line theme.css is a smell: it makes every edit a needle-in-a-haystack and re-reads expensive. Split styles by the file they belong to. Every stylesheet you create MUST be imported where it is used (e.g. \`import './Menu.css'\` in Menu.tsx, \`import './styles/theme.css'\` in App.tsx) or none of its rules apply.
Responsive targets: 390px phone, 768px tablet, 1200px+ desktop.

**React imports — read carefully:** Always use NAMED hook imports:
  \`import { useState, useEffect, useRef, useCallback, useMemo } from 'react'\`
  NEVER \`import React from 'react'\` — the default import does NOT work in this ESM build and is a common cause of runtime crashes. JSX is automatic (no React import needed to render JSX).
</environment>

<design-excellence>
Your default output should look intentional and modern, never like a generic template. Aim for the bar of Linear, Stripe, Vercel, and Apple.
- **Color:** define a real system in theme.css — a brand hue, neutrals (background/surface/border/text), and semantic tokens — as CSS custom properties. Ensure text contrast ≥ 4.5:1. Support a cohesive look; add a dark theme via \`[data-theme="dark"]\` when it fits.
- **Type:** a clear scale (e.g. 12/14/16/20/24/32/48), generous line-height for body (~1.6), tight for headings. System font stack.
- **Space & layout:** consistent spacing scale (4/8/12/16/24/32/48/64), max-width content containers, real alignment and rhythm. Use CSS grid/flex deliberately.
- **Depth & polish:** subtle shadows, rounded corners, hover/active/focus states on every interactive element, smooth 150–300ms transitions. Respect \`prefers-reduced-motion\`.
- **States:** design empty, loading, error, and hover/focus states — not just the happy path.
- **Semantics & a11y:** header/nav/main/section/footer, labelled inputs, visible focus rings, buttons for actions and links for navigation.
Avoid the generic-AI look: no unstyled centered column of plain text, no default blue links, no inconsistent spacing.
</design-excellence>

<approach>
Work like a senior engineer, scaled to the task. A small tweak needs no ceremony; a new app deserves a plan.

1. **Understand & load skills.** For changes to an existing project, list_files and read the files you'll touch before editing. For research-y questions, search_files. **Then load the skill(s) that match the task** (see <available-skills>) — do this before planning or writing code, not after you're stuck. A UI build loads frontend-design + ui-ux-pro-max; an animation task adds motion-dev-animations; a perf task loads performance/core-web-vitals. Loading is cheap and is the normal first move, not an exception.
2. **Plan (for non-trivial new work).** Use think to decide the component tree, routes, color system, and the file list — informed by the skill you just loaded — then build to that plan.
3. **Build.** Create files in dependency order: theme.css → App.tsx → pages → components. **Write ONE file per turn** — a single write_file per response — so each file is generated and shown to the user one at a time, the way a careful engineer works through a project. Never emit several write_file calls in the same turn. Write complete files. Keep components focused.
4. **Verify efficiently.** compile after a coherent batch of related edits (it builds AND runs the app), and always before done. Fix every build and runtime error before moving on. Delete files you no longer use.
5. **Finish.** There is no automated reviewer after you — verify your own work. Before done, make sure the LAST compile passed build + runtime, every requested feature exists and works, and the result is responsive and polished. Then call done once and stop — do not keep polishing or re-compiling after a clean pass.
</approach>

<tool-guidance>
- Keep visible narration concise and useful. Do not announce routine file operations like "Now I will write..." right before using a tool; the UI already shows tool calls. Use text only for intent, important decisions, blockers, and final human-readable summaries.
- **Opening overview (new project only):** At the very start of a create-mode build, before any tool calls, write a brief markdown overview of what you will build. Use this structure: a bold project type heading, one sentence of description, then a bullet list of the key features you will implement (5–8 bullets, each with a **bold feature name** followed by a short description). This is the only place narration should precede tools — skip it for refine/fix tasks.
- **think** — reason about design/architecture before building, or about a fix before editing. Cheap; use it to avoid drift.
- **write_file** — new files or full rewrites. Always complete code.
- **edit_file** — one targeted change. **multi_edit** — several changes to ONE file at once (atomic; preferred over repeated edit_file on the same file).
- **delete_file** — remove dead/unused files so the project stays clean.
- **read_file / list_files / search_files** — understand before you change. On a refine, list_files first, then read only the 2-3 files you will actually touch — do not fish around the project with speculative searches before you have read the obvious files. Read each file ONCE: extract everything you need in that single read, then plan all changes with think, then apply them all with multi_edit. Do NOT re-read after an edit — the tool confirms success. Do NOT re-read to "verify the current state" — use search_files with context_lines to look up a specific section instead. Reading the same file again without editing it first is wasted tokens and a sign of drift.
- **search_files glob** — a pattern with no slash matches by filename anywhere (e.g. \`*.css\` finds src/styles/theme.css; \`Menu.tsx\` finds src/pages/Menu.tsx). Use a path like \`src/pages/**\` only when you specifically want to scope to a directory.
- **set_title** — call once at the very start of a new project (create mode) with a 3-6 word title.
- **compile** — the source of truth for "does it work". Run it after writing or editing files. Do NOT compile again if no files changed since the last passing compile — the result will be identical.
- **done** — only when compile (build + runtime) passed and every requirement is met.
- **load_skill** — load deep domain knowledge at the START of a task, before planning or writing code. Returns the full skill body as text. This is your normal first move on any real build (UI → frontend-design + ui-ux-pro-max; animation → motion-dev-animations; perf → performance/core-web-vitals; shadcn/ui → shadcn; coding quality → karpathy-guidelines), not a last resort when stuck. See <available-skills> for the full matching guide.
</tool-guidance>

<available-skills>
Skills carry deep domain knowledge that is NOT in this prompt. Loading the relevant skill is the difference between generic output and expert output — it is not optional ceremony. **At the start of a task, before you plan or write code, load the skill(s) that match the work.** This is the normal way you work, not something to do only when stuck or only when asked.

- ui-ux-pro-max          → Design intelligence: 99 UX guidelines, color palettes, responsive patterns, accessibility, typography, animation, forms, navigation, charts
- frontend-design        → Distinctive interfaces with bold aesthetic direction; avoids generic AI aesthetics; creative typography and layout choices
- react-best-practices   → React 19 hooks, effects, refs, composition, component patterns
- motion-dev-animations  → Motion.dev (Framer Motion successor): 120fps animations, scroll effects, gestures, spring physics
- performance            → Loading speed, code splitting, image optimization, fonts, caching, runtime perf
- core-web-vitals        → LCP, INP, CLS — specific fixes, checklists, React patterns
- shadcn                 → shadcn/ui component library: CLI setup, component composition recipes, theming with CSS variables, anti-patterns, design direction
- karpathy-guidelines    → Coding discipline: think before coding, simplicity first, surgical changes, goal-driven execution

When to load (match the task, load all that apply — loading is cheap, shipping mediocre work is not):
- Building or restyling ANY UI, page, component, or layout → **frontend-design** AND **ui-ux-pro-max** (always, for new builds — this is most tasks).
- Using shadcn/ui components (Button, Card, Dialog, Table, etc.) → **shadcn**.
- Adding/tuning animation, transitions, scroll effects, gestures → **motion-dev-animations**.
- Writing or refactoring React logic (hooks, state, effects, composition) → **react-best-practices**.
- Slowness, large bundles, image/font loading, or LCP/INP/CLS work → **performance** and/or **core-web-vitals**.
- Any non-trivial coding task where quality and discipline matter → **karpathy-guidelines**.

Skip loading only for pure conversation (a greeting or a question that needs no code) and the most trivial mechanical edits (fix a typo, change one literal value) where no domain judgment is involved. When in doubt, load the skill.
</available-skills>

<rules>
- Never create an empty file or leave placeholder comments (TODO/FIXME/"...").
- Import only react, react-dom, react-router-dom, and the curated allowlist. No CDN fonts or icon packs. Real photographic images ARE allowed via https URLs, but ONLY from the free-to-use hosts (images.unsplash.com, picsum.photos, placehold.co) — never hotlink a copyrighted image from any other site. The done check rejects images from non-free hosts.
- **Every stylesheet must be imported.** A .css file that no module imports applies ZERO styles — the app renders with browser defaults and looks broken even though it compiles. After writing src/styles/theme.css (or any .css), confirm it is imported in src/App.tsx. compile warns about unimported stylesheets and done is REJECTED while one exists.
- Valid TypeScript; avoid \`any\`. One default export per component file. All files under src/.
- When compile returns errors (build OR runtime), read the file, find the real cause, and fix it precisely — don't guess-and-repeat the same edit.
- If an edit_file keeps failing to match, re-read the file or use write_file to replace it — don't loop on the same failing edit.
- Do not re-read a file you just successfully edited — the tool confirms the change was applied. One read before an edit is enough.
- Do not compile twice in a row without a file change between them — the result is identical.
- The last action before done must be a compile that passed both build and runtime checks.
- **Read each file at most once per turn.** Do not re-read to "check" or "verify" after edits. If you need a specific section, use search_files with context_lines, not another read_file.
- **Only read files you will actually edit.** Do not read App.tsx and theme.css before editing Game.tsx — read only the file(s) you are about to change.
- **For any numeric parameter (speeds, gaps, timers, animation rates), calculate the real-world value before picking a number.** State the math explicitly: "At speed 6px/frame × 60fps, gap=300px → 0.83s between obstacles — is that enough?" Doubling a number without calculating is guessing.
- **For games/animations/simulations, trace every trigger condition once before done** (spawn, collision, score, win/lose). Walk through 2-3 concrete frames on paper: "frame 0: nextSpawnAt=120; frame 1: ...; does \`frameCount >= nextSpawnAt\` ever become true?" A condition whose threshold is recomputed every frame can never fire — this class of bug compiles and renders cleanly, so the compile tool will NOT catch it. Only this trace will.
- **When a visual behavior is wrong, use think to trace the full pipeline before touching code.** What value drives this behavior? What does that value produce at runtime? What should it produce? Only after answering all three should you edit.
- **One file per turn.** Emit a single write_file per turn so each file is generated and revealed to the user one at a time — never bundle multiple write_file calls into one response. You do not need to read a file you are going to fully replace or delete. Compile ONCE after the whole set of files is written, not after every file. (Cheap non-content cleanup is the only exception: you may issue several delete_file calls together in one turn when clearing starter/boilerplate.)
- **Stop when it works.** Once compile passes build + runtime and every requirement is met, call done. Do not re-read files, re-compile unchanged code, or add unrequested "polish" loops — that wastes turns and risks breaking a working build.
- **Formatted final summary.** When you finish (same turn as the done tool call), write a markdown recap of what was built. Use a **bold project title** on its own line, then a short one-sentence description of the overall product, then a bullet list of key features delivered — each bullet with a **bold feature name** and a brief description. Do not restate that compile passed, do not list filenames, and do not repeat the summary a second time.
</rules>

<examples>
User: "Build a landing page for a SaaS product"
→ [opening markdown overview: bold heading + 1-sentence description + bullet list of features to build] → think (brand colors, type scale, sections, file plan) → write theme.css [turn] → write App.tsx [turn] → write pages/Home.tsx (hero, features, pricing, CTA) [turn] → write components/Navbar.tsx [turn] → write components/Footer.tsx [turn] → compile → fix errors → audit vs request → done (+ formatted markdown recap with bold feature bullets). Each write is its own turn — one file at a time.

User: "Add a dark mode toggle"
→ list_files → read theme.css + App.tsx → think (data-theme strategy) → multi_edit theme.css (add [data-theme="dark"] tokens + transitions) → edit_file App.tsx (toggle state + data-theme on root) → write components/ThemeToggle.tsx → compile → done.

User: "The score doesn't reset when I restart"
→ search_files "score" → read the component → think (where state resets) → edit_file the reset handler → compile (build + runtime) → done.

User: "hey" / "what is this application?"
→ No tools (or read-only tools to answer about the project) → reply in plain text: greet, explain, or ask what they'd like to build. Do NOT create or modify files, and do NOT call done.
</examples>

<routing-hint>
For multiple pages, use react-router-dom with **HashRouter** (works in preview, deploy, and GitHub Pages). Import { HashRouter, Routes, Route, Link, NavLink, useNavigate, useParams, Outlet } from 'react-router-dom'. Use <Link>/<NavLink> for navigation, never plain <a> for internal routes. Add a <Route path="*"> fallback. For single-page scroll sites, skip routing and use id anchors.
</routing-hint>

<non-negotiables>
The few rules that override everything above if they ever conflict:
- **Honesty:** never call anything done/working/fixed unless the CURRENT files passed compile (build + runtime). Report what the tool returned, not what you hoped.
- **Verify before done:** the last action before done is a passing compile.
- **Don't loop:** never repeat an action that just failed or re-read/re-compile unchanged files. Change strategy or finish.
- **Finish, then stop:** implement the request end-to-end, then call done once. No half-done handoffs, no unrequested polish loops.
- **Stay in the sandbox:** only react/react-dom/react-router-dom + the curated allowlist; images only from the three free-to-use hosts; every stylesheet imported.
</non-negotiables>`,nr=`<system-reminder>
## Spec Phase — Plan Before Building

**Everything below applies ONLY if the user's message is an actual request to build something.** If it is a greeting, casual remark, or question (e.g. "hey", "what is this?"), skip this entire phase: reply in plain text with no tool calls — greet them, answer, or ask what they would like to build.

**First:** In this same opening turn, write a brief **markdown overview** of what you're about to build — a bold project-type heading, one sentence of description, then a 5–8 item bullet list of the key features you'll implement (each with a **bold feature name** + short description). Then call set_title with a concise 3-6 word title. This overview is the user's first signal that you understood the request — never skip it on a build.

Before writing any code, spend 1-2 turns planning:

1. Use **think** to reason about:
   - What components/pages are needed?
   - What's the color system? (2-3 brand colors + neutrals)
   - What's the component tree? (App → Layout → Pages → Components)
   - Any routing needed? (multi-page vs single-page scroll)
   - What's the mobile-first responsive strategy?

2. **Define the requirements.** Call update_plan with set_requirements listing the concrete, checkable features you will build — one per feature, specific enough to verify later (e.g. "4 colored tiles that flash in sequence", "sequence grows by one each round", "score + best-score persisted", "game-over screen with restart button"). If the request is open-ended (e.g. "build any game you want"), DECIDE what you're building and list ITS features. Never leave the checklist empty or vague — it is the spec you build and self-check against. Check each item off with update_plan as you finish it.

3. Use **think** to outline the file plan:
   - List each file you'll create and what it contains
   - Order matters: theme.css first, then App.tsx, then pages, then components

After planning, start building. **Write exactly one file per turn** (a single write_file per response) so the user watches the project come together one file at a time — never emit multiple write_file calls in one turn. Compile ONCE after the full set of files is written, not after every file.
</system-reminder>`;function or(e){return e.hasPendingErrors?"debug":e.mode==="create"&&e.turnCount<=2?"plan":"build"}function sr(e){const t=Bt(e.thinkingLevel),o=or(e),n=yn[t].thinking[o];return n<=0?0:Math.max(1024,Math.min(12e3,Math.round(n)))}function ir(e){const t=Bt(e),o=yn[t],n={low:"Move quickly. Use concise thinking only when it prevents mistakes. Prefer focused edits, batch related changes, compile after the main change, and avoid optional polish loops unless needed for correctness.",medium:"Use the standard workflow. Plan non-trivial work, build in sensible batches, compile regularly, and finish after the required checks pass.",high:"Be more deliberate. Spend extra attention on architecture, responsive behavior, edge cases, and cleanup. Use additional fix/verify turns when the result is not polished.","extra-high":"Use the deepest workflow. Start with a careful plan, break work into clear steps, verify thoroughly across requirements, runtime, types, visual quality, and user experience, and take the time needed to resolve issues instead of rushing."};return`<system-reminder>
## Thinking Level: ${o.label}

${o.description}
${n[t]}
</system-reminder>`}function Ro(e,t,o){const n=t.toLowerCase();return e==="google"?/gemini-3\.[0-9]|thinking/.test(n)?{thinkingConfig:{thinkingLevel:o>=6e3?"high":o>=3e3?"medium":o>=1e3?"low":"minimal"}}:/gemini-2\.5/.test(n)?{thinkingConfig:{thinkingBudget:Math.min(o,8192)}}:{}:/(^|[/_-])o[1345]($|[/_-])|gpt-5|gpt5|o3|o4|reasoner|deepseek-r|gpt-oss|grok.+reasoning/.test(n)?{reasoning_effort:o>=6e3?"high":o>=3e3?"medium":"low"}:{}}function rr(e){const o=e.includes("read_file")?`- You are re-reading the same file without making any changes. Stop. Reading it again will not reveal anything new. Either make a targeted edit_file fix right now, or if the build passes and the logic is correct, call done immediately — reading more will not help.
`:"";return`<system-reminder>
## You appear to be stuck

${e}

Repeating the same action will not work. Change strategy now:
${o}- If an edit keeps failing to match → re-read the file with read_file, or use write_file to replace the whole file.
- If the same compile/runtime error keeps returning → read the actual file around the error line and fix the real cause; do not re-apply the same change.
- If you are unsure → use think to reconsider the approach before acting.
</system-reminder>`}function ar(e){return`<system-reminder>
## Turn budget low: ${e} turn(s) remain

The run ends automatically when turns run out — unfinished work is what the user gets. Prioritize landing the build:
1. Finish only what is essential to the core request; skip optional polish.
2. Reserve the final 2 turns: one for compile (build + runtime), one for done.
3. If not every requested feature can be finished, complete the most important ones and call done with an honest summary of what is and isn't included.
</system-reminder>`}const Qn=[{id:"ui-ux-pro-max",description:"Design intelligence: color palettes, UX rules, responsive patterns, accessibility, typography, animation principles",body:$i},{id:"frontend-design",description:"Distinctive interfaces with bold aesthetic direction; avoids generic AI aesthetics; creative typography and layout choices",body:Oi},{id:"react-best-practices",description:"React 19 hooks, effects, refs, composition, component patterns",body:Di},{id:"motion-dev-animations",description:"Motion.dev (Framer Motion successor): 120fps animations, scroll effects, gestures, spring physics",body:Bi},{id:"performance",description:"Loading speed, code splitting, image optimization, fonts, caching, runtime performance",body:Fi},{id:"core-web-vitals",description:"LCP, INP, CLS — specific fixes, checklists, React/Next.js patterns",body:Ui},{id:"shadcn",description:"shadcn/ui component library: CLI setup, component composition recipes, theming with CSS variables, common gotchas, design direction",body:Wi},{id:"karpathy-guidelines",description:"Coding discipline: think before coding, simplicity first, surgical changes, goal-driven execution with verifiable criteria",body:Hi}],lr=`<system-reminder>
The conversation has been compacted to save context. Older tool outputs (file reads, listings, search results, compile output) have been truncated. The current project file state is accurate in the workspace. Below is a summary of progress so far.
</system-reminder>`,cr=new Set(["ts","tsx","js","jsx"]);function dr(e,t){if(!cr.has(e))return{code:t,changed:!1,removedImports:[]};let o=t;const n=pr(o);return n.code!==o&&(o=n.code),o=ur(o),{code:o,changed:o!==t,removedImports:n.removed}}function ur(e){let o=e.split(`
`).map(n=>n.replace(/[ \t]+$/,"")).join(`
`);return o=o.replace(/\n{3,}/g,`

`),o=o.replace(/\n+$/,"")+`
`,o}function pr(e){const t=/^(\s*)import\s*\{([^}]*)\}\s*from\s*['"]react['"]\s*;?\s*$/m,o=e.match(t);if(!o)return{code:e,removed:[]};const n=o[1],i=o[2];if(/\bas\b/.test(i))return{code:e,removed:[]};const r=i.split(",").map(f=>f.trim()).filter(Boolean);if(r.length===0)return{code:e,removed:[]};const l=[],h=[];for(const f of r){const u=f.replace(/^type\s+/,"").trim();if(!/^[A-Za-z_$][\w$]*$/.test(u)){h.push(f);continue}hr(e,u)<=1?l.push(f):h.push(f)}if(l.length===0)return{code:e,removed:[]};const a=h.length===0?"":`${n}import { ${h.join(", ")} } from 'react'`;let m=e.replace(t,a);return h.length===0&&(m=m.replace(/^\n/,"")),{code:m,removed:l}}function hr(e,t){const o=new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`,"g");return(e.match(o)??[]).length}function Lo(e){const t=e.filter(n=>n.path.toLowerCase().endsWith(".css"));if(t.length===0)return[];const o=[];for(const n of t){if(!/\{[\s\S]*\}/.test(n.code))continue;const r=(n.path.split("/").pop()??n.path).replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),l=new RegExp(`["'(/]${r}["')]`);e.some(a=>a.path!==n.path&&l.test(a.code))||o.push(n.path)}return o}const mr=["images.unsplash.com","source.unsplash.com","picsum.photos","fastly.picsum.photos","placehold.co"],fr=/https?:\/\/[^\s'"()<>]+\.(?:jpe?g|png|gif|webp|avif|bmp|svg)(?:[?#][^\s'"()<>]*)?/gi,gr=/url\(\s*['"]?(https?:\/\/[^'")]+?)['"]?\s*\)/gi,yr=/<img\b[^>]*?\bsrc\s*=\s*['"](https?:\/\/[^'"]+)['"]/gi;function br(e){try{return new URL(e).hostname.toLowerCase()}catch{return null}}function vr(e){return mr.some(t=>e===t||e.endsWith("."+t))}function Mo(e){const t=[],o=new Set,n=(i,r)=>{const l=r.trim().replace(/[)'"]+$/,""),h=br(l);if(!h||vr(h))return;const a=`${i}|${l}`;o.has(a)||(o.add(a),t.push({path:i,url:l}))};for(const i of e)for(const r of[fr,gr,yr]){r.lastIndex=0;let l;for(;(l=r.exec(i.code))!==null;)n(i.path,l[1]??l[0])}return t}const wr=1400,eo=8e3;function _r(e,t,o=!1){return`<script>
(function(){
  if (typeof window === 'undefined') return;
  var TOKEN = ${JSON.stringify(e)};
  var INTERACTIVE = ${o?"true":"false"};
  var fatal = [];
  var consoleErrors = [];
  var interactionErrors = [];
  var routeErrors = [];
  var canvasNaNCount = 0;
  var canvasNaNSample = '';
  var interactionsRun = 0;
  var domChanged = false;

  function describe(value) {
    if (value == null) return String(value);
    if (value instanceof Error) return value.name + ': ' + value.message;
    if (typeof value === 'object') {
      try { return JSON.stringify(value); } catch (e) { return Object.prototype.toString.call(value); }
    }
    return String(value);
  }

  window.addEventListener('error', function(event) {
    if (event && event.error) fatal.push(describe(event.error));
    else if (event && event.message) fatal.push(event.message);
  }, true);

  window.addEventListener('unhandledrejection', function(event) {
    var reason = event ? event.reason : null;
    fatal.push('Unhandled promise rejection: ' + describe(reason));
  });

  var originalConsoleError = console.error;
  console.error = function() {
    try {
      var parts = Array.prototype.slice.call(arguments).map(describe);
      consoleErrors.push(parts.join(' '));
    } catch (e) { /* ignore */ }
    return originalConsoleError.apply(console, arguments);
  };

  // ── Canvas guard ───────────────────────────────────────────────
  // Canvas games and visualisations fail SILENTLY: drawing at a NaN/Infinity
  // coordinate or size (e.g. a variable that is undefined because it was
  // declared inside a block but used outside it) throws nothing and renders
  // nothing, so the sprite is invisible while the runtime check still "passes".
  // Wrap the 2D context draw calls and count non-finite numeric arguments; a
  // persistent count (a per-frame bug repaints hundreds of times) is reported.
  (function installCanvasGuard(){
    if (typeof CanvasRenderingContext2D === 'undefined') return;
    var proto = CanvasRenderingContext2D.prototype;
    var methods = ['fillRect','strokeRect','clearRect','rect','arc','arcTo','ellipse',
      'moveTo','lineTo','quadraticCurveTo','bezierCurveTo','fillText','strokeText',
      'translate','scale','setTransform','transform','drawImage'];
    methods.forEach(function(name){
      var orig = proto[name];
      if (typeof orig !== 'function') return;
      proto[name] = function(){
        for (var i = 0; i < arguments.length; i++) {
          var a = arguments[i];
          if (typeof a === 'number' && !isFinite(a)) {
            canvasNaNCount++;
            if (!canvasNaNSample) canvasNaNSample = name;
            break;
          }
        }
        return orig.apply(this, arguments);
      };
    });
  })();

  // ── Interaction driver ──────────────────────────────────────────
  // Exercises the rendered UI to catch "looks done but buttons do nothing /
  // throw" bugs. We prevent real form submits and full navigations so the
  // page stays alive, click a bounded set of controls, type into text inputs,
  // and watch for thrown errors and DOM mutations.
  function snapshotDom() {
    var root = document.getElementById('root');
    return root ? (root.innerHTML || '').length + ':' + root.querySelectorAll('*').length : '0:0';
  }

  function runInteractions() {
    // Block anything that would unload the document.
    document.addEventListener('submit', function(e){ e.preventDefault(); }, true);

    var before = snapshotDom();
    var MAX = 8;

    // Buttons and role=button / [data-testid] clickables (skip obviously
    // destructive or navigation-away controls).
    var clickables = [].slice.call(
      document.querySelectorAll('button, [role="button"], input[type="checkbox"], input[type="radio"], [data-interactive]')
    ).slice(0, MAX);
    for (var i = 0; i < clickables.length; i++) {
      var el = clickables[i];
      try {
        if (el.disabled) continue;
        el.click();
        interactionsRun++;
      } catch (err) {
        interactionErrors.push(describe(err));
      }
    }

    // Type into the first few text-like inputs and fire input/change.
    var inputs = [].slice.call(
      document.querySelectorAll('input[type="text"], input[type="email"], input[type="search"], input:not([type]), textarea')
    ).slice(0, 4);
    for (var j = 0; j < inputs.length; j++) {
      var inp = inputs[j];
      try {
        var setter = Object.getOwnPropertyDescriptor(
          inp.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
          'value'
        );
        if (setter && setter.set) { setter.set.call(inp, 'Test input'); }
        else { inp.value = 'Test input'; }
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        interactionsRun++;
      } catch (err) {
        interactionErrors.push(describe(err));
      }
    }

    // Press common control/game keys. Canvas games and keyboard shortcuts are
    // driven by keydown — click-driving never reaches them, so a jump/move
    // handler that throws (or computes a NaN coordinate) would go unseen. We
    // fire on both document and window since apps bind to either.
    var keys = [
      { key: ' ', code: 'Space', keyCode: 32 },
      { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
      { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
      { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
      { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
      { key: 'Enter', code: 'Enter', keyCode: 13 }
    ];
    for (var ki = 0; ki < keys.length; ki++) {
      var k = keys[ki];
      try {
        var opts = { key: k.key, code: k.code, keyCode: k.keyCode, which: k.keyCode, bubbles: true, cancelable: true };
        document.dispatchEvent(new KeyboardEvent('keydown', opts));
        window.dispatchEvent(new KeyboardEvent('keydown', opts));
        document.dispatchEvent(new KeyboardEvent('keyup', opts));
        window.dispatchEvent(new KeyboardEvent('keyup', opts));
        interactionsRun++;
      } catch (err) {
        interactionErrors.push(describe(err));
      }
    }

    domChanged = snapshotDom() !== before;
  }

  // ── Route driver ───────────────────────────────────────────────
  // Click-through is not enough: a route can render WITHOUT throwing yet show a
  // broken view (e.g. "Product not found" because a string route param is
  // compared against a numeric id). We visit the app's own internal hash routes
  // and flag any that land on a not-found / error state the home view did not
  // already show — the single most common "compiles but is broken" failure.
  var ERROR_RE = /(not found|page not found|404|does not exist|no such|couldn't find|couldnt find|cannot find|can't find|failed to load|went wrong)/i;

  function rootText() {
    var root = document.getElementById('root');
    return root ? (root.textContent || '') : '';
  }
  function delay(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

  function collectInternalRoutes() {
    var seen = {};
    var hrefs = [];
    var anchors = [].slice.call(document.querySelectorAll('a[href^="#/"]'));
    for (var i = 0; i < anchors.length; i++) {
      var href = anchors[i].getAttribute('href');
      if (!href || href === '#/' || href === '#') continue;
      if (seen[href]) continue;
      seen[href] = true;
      hrefs.push(href);
    }
    // Prefer dynamic detail routes (/product/1, /item/abc) so we exercise data
    // lookups, not just static pages.
    hrefs.sort(function (a, b) {
      var ad = /\\/[^/]+\\/[\\w-]+/.test(a) ? 0 : 1;
      var bd = /\\/[^/]+\\/[\\w-]+/.test(b) ? 0 : 1;
      return ad - bd;
    });
    return hrefs.slice(0, 6);
  }

  function navigateRoutes() {
    var routes = collectInternalRoutes();
    if (routes.length === 0) return Promise.resolve();
    var baselineHadError = ERROR_RE.test(rootText());
    var chain = Promise.resolve();
    routes.forEach(function (href) {
      chain = chain.then(function () {
        try { window.location.hash = href; } catch (e) { interactionErrors.push(describe(e)); return; }
        return delay(200).then(function () {
          try {
            var txt = rootText();
            if (!baselineHadError && ERROR_RE.test(txt)) {
              var snippet = txt.replace(/\\s+/g, ' ').trim().slice(0, 140);
              routeErrors.push('Route ' + href + ' rendered an error/not-found view: "' + snippet + '"');
            }
            interactionsRun++;
          } catch (e) { interactionErrors.push(describe(e)); }
        });
      });
    });
    // Return home so the final report reflects a normal view, not the last route.
    chain = chain.then(function () { try { window.location.hash = '#/'; } catch (e) {} return delay(120); });
    return chain;
  }

  var reported = false;
  function report() {
    if (reported) return;
    reported = true;
    var root = document.getElementById('root');
    var rendered = !!(root && (root.childElementCount > 0 || (root.textContent || '').trim().length > 0));
    // A persistent non-finite draw argument (many repaints, not a one-off init
    // transient) means part of the canvas scene is silently invisible.
    var canvasErrors = [];
    if (canvasNaNCount >= 8) {
      canvasErrors.push('Canvas drawing received a non-finite value (NaN/Infinity) ' + canvasNaNCount +
        ' times, first via ctx.' + canvasNaNSample + '. A coordinate or size passed to the canvas is ' +
        'undefined/NaN, so that part of the scene never renders even though nothing throws.');
    }
    try {
      parent.postMessage({
        __bloomRuntimeCheck: TOKEN,
        fatalErrors: fatal,
        consoleErrors: consoleErrors,
        rendered: rendered,
        interactionsRun: interactionsRun,
        interactionErrors: interactionErrors,
        routeErrors: routeErrors,
        canvasErrors: canvasErrors,
        domChanged: domChanged
      }, '*');
    } catch (e) { /* ignore */ }
  }

  function settleThenReport() {
    if (INTERACTIVE) {
      // Let the app mount, drive its controls, walk its internal routes, let
      // effects settle, then report.
      try { runInteractions(); } catch (e) { interactionErrors.push(describe(e)); }
      var done = function () { setTimeout(report, 600); };
      try { navigateRoutes().then(done, done); } catch (e) { interactionErrors.push(describe(e)); done(); }
    } else {
      report();
    }
  }

  // Report after the app has mounted and run a few frames. We listen on load
  // so module scripts (deferred) have finished evaluating first.
  if (document.readyState === 'complete') {
    setTimeout(settleThenReport, ${t});
  } else {
    window.addEventListener('load', function(){ setTimeout(settleThenReport, ${t}); });
  }
  // Safety: always report eventually, even if 'load' never fires. Allow extra
  // headroom for the interactive route walk to finish before this fires.
  setTimeout(report, ${t} + (INTERACTIVE ? 6000 : 2500));
})();
<\/script>`}function kr(e,t){return e.includes("<head>")?e.replace("<head>",`<head>
${t}`):t+`
`+e}let an=0;function xr(){return an+=1,`bloom-rt-${an}-${an*2654435761%2147483647}`}async function Po(e,t={}){const o={ok:!0,ran:!1,fatalErrors:[],consoleErrors:[],rendered:!1};if(typeof document>"u"||typeof window>"u")return o;const n=t.interactive??!1,i=t.waitMs??wr,r=xr(),l=kr(e,_r(r,i,n));return new Promise(h=>{const a=document.createElement("iframe");a.style.cssText="position:fixed;top:-9999px;left:-9999px;width:1024px;height:768px;border:none;opacity:0;pointer-events:none;",a.setAttribute("sandbox","allow-scripts");let m=!1;const f=()=>{window.removeEventListener("message",v),clearTimeout(b);try{document.body.removeChild(a)}catch{}},u=w=>{m||(m=!0,f(),h(w))},v=w=>{const _=w.data;if(!_||_.__bloomRuntimeCheck!==r)return;const A=Array.isArray(_.fatalErrors)?_.fatalErrors.map(P=>String(P)):[],k=Array.isArray(_.consoleErrors)?_.consoleErrors.map(P=>String(P)):[],j=!!_.rendered,I=Array.isArray(_.interactionErrors)?_.interactionErrors.map(P=>String(P)):[],S=Array.isArray(_.routeErrors)?_.routeErrors.map(P=>String(P)):[],N=Array.isArray(_.canvasErrors)?_.canvasErrors.map(P=>String(P)):[],L=Number(_.interactionsRun)||0,H=!!_.domChanged,$=A.length===0&&I.length===0&&S.length===0&&N.length===0&&!(j===!1&&k.length>0);u({ok:$,ran:!0,fatalErrors:A,consoleErrors:k,rendered:j,interactionsRun:L,interactionErrors:I,routeErrors:S,canvasErrors:N,domChanged:H})},b=setTimeout(()=>{u({...o,ran:!0})},n?eo+4e3:eo);window.addEventListener("message",v),document.body.appendChild(a),a.srcdoc=l})}async function jr(e,t={}){return Po(e,{...t,interactive:!0})}function $o(e){if(!e.ran)return null;const t=e.interactionErrors??[],o=e.routeErrors??[],n=e.canvasErrors??[];if(e.ok&&e.consoleErrors.length===0&&t.length===0&&o.length===0&&n.length===0)return null;const i=[];n.length>0&&(i.push("Canvas check FAILED — content is being drawn off-screen / invisibly:"),n.slice(0,4).forEach((l,h)=>i.push(`  ${h+1}. ${l}`)),i.push("Nothing throws, so trace the value passed as the x/y/width/height (or transform) argument back to where it is computed. The usual cause is a variable that is undefined at the draw site — e.g. declared with const/let inside an `if`/loop block but read outside it, or a state value that has not been initialised. Fix the source of the NaN, then compile again.")),o.length>0&&(i.push("Route check FAILED — a link the app itself renders leads to a broken view:"),o.slice(0,8).forEach((l,h)=>i.push(`  ${h+1}. ${l}`)),i.push("The route did not throw, so the bug is logic — not a crash. The most common cause is the route param being a string while the lookup compares it against a number (e.g. `items.find(x => x.id === id)` where `id` from useParams is a string). Read the page component and its data lookup, fix the comparison/param parsing, then compile again.")),e.fatalErrors.length>0&&(i.push(`Runtime check FAILED — the app threw ${e.fatalErrors.length} uncaught error(s) when rendered:`),e.fatalErrors.forEach((l,h)=>i.push(`  ${h+1}. ${l}`))),t.length>0&&(i.push(e.fatalErrors.length>0?"":"Interaction check FAILED — a control threw when used:"),t.slice(0,8).forEach((l,h)=>i.push(`  interaction error ${h+1}: ${l}`)),i.push("A button/input handler crashed when exercised. Find the handler, fix the bad reference or state update, then compile again.")),e.consoleErrors.length>0&&(i.push(e.fatalErrors.length>0?"":"Runtime check — console errors detected:"),e.consoleErrors.slice(0,8).forEach((l,h)=>i.push(`  console.error ${h+1}: ${l}`))),!e.rendered&&e.fatalErrors.length===0&&e.consoleErrors.length===0&&i.push("Note: the app did not render any visible content into #root.");const r=e.fatalErrors.length>0||t.length>0||e.consoleErrors.length>0;return!e.ok&&r&&i.push("","These are RUNTIME errors found by actually running the app — esbuild does not catch them. Read the affected file, find the undefined variable / bad reference / broken hook, fix it with edit_file, then compile again."),i.join(`
`)}const Sr="openthorn.memory.",Cr=40,Oo=new Map;function Do(e){return`${Sr}${e||"anon"}`}function Er(e){try{if(typeof localStorage<"u")return localStorage.getItem(e)}catch{}return Oo.get(e)??null}function Tr(e,t){try{if(typeof localStorage<"u"){localStorage.setItem(e,t);return}}catch{}Oo.set(e,t)}function mn(e){const t=Er(Do(e));if(!t)return[];try{const o=JSON.parse(t);return Array.isArray(o)?o.filter(n=>n&&typeof n.id=="string"&&typeof n.content=="string"):[]}catch{return[]}}function Nr(e,t){const o=[...t].sort((n,i)=>i.weight-n.weight||i.updated.localeCompare(n.updated)).slice(0,Cr);Tr(Do(e),JSON.stringify(o))}let to=0;function Ir(){return to+=1,`${Date.now().toString(36)}-${to}`}function no(e){return e.trim().replace(/\s+/g," ").toLowerCase()}function oo(e,t,o){const n=o.trim();if(!n)return mn(e);const i=mn(e),r=no(n),l=i.find(h=>no(h.content)===r);return l?(l.weight+=1,l.updated=new Date().toISOString().slice(0,10)):i.push({id:Ir(),kind:t,content:n,weight:1,updated:new Date().toISOString().slice(0,10)}),Nr(e,i),i}function Ar(e){if(e.length===0)return"";const t=["preference","fix","fact"],o=[...e].sort((r,l)=>t.indexOf(r.kind)-t.indexOf(l.kind)||l.weight-r.weight),n={preference:"Design preference",fix:"Known fix",fact:"Fact"},i=["<system-reminder>","## What I know about this user (across projects)"];for(const r of o.slice(0,15)){const l=r.weight>=3?" (strong)":"";i.push(`- ${n[r.kind]}${l}: ${r.content}`)}return i.push("Apply preferences by default unless this request overrides them."),i.push("</system-reminder>"),i.join(`
`)}function Rr(e){const t=e.toLowerCase(),o=[],n=(i,r)=>{i.test(t)&&o.push(r)};return n(/\bdark\s*mode|dark\s*theme|dark\b/,"Tends to want dark themes."),n(/\bminimal|clean|simple\b/,"Prefers minimal, clean design."),n(/\bplayful|fun|colou?rful|vibrant\b/,"Likes playful, colorful visuals."),n(/\bglass(morphism)?\b/,"Likes glassmorphism / frosted surfaces."),n(/\bbrutalis|retro|vintage\b/,"Drawn to bold retro/brutalist styles."),n(/\banimat|motion|interactive\b/,"Values motion and micro-interactions."),o}const so=`# OpenThorn Agent — Lessons Learned

> Auto-generated by the agent. Do not edit manually.
> Format: \`## YYYY-MM-DD\` → \`- TYPE: content\`
> Types: FIX (correction), PATTERN (user preference), GOTCHA (non-obvious behavior), TRIED (failed approach), WORKS (proven solution)

`;function Lr(e){if(e.length===0)return so;const t=new Map;for(const n of e){const i=t.get(n.date)||[];i.push(n),t.set(n.date,i)}let o=so;for(const[n,i]of[...t.entries()].sort().reverse()){o+=`## ${n}
`;for(const r of i)o+=`- ${r.type}: ${r.content}
`;o+=`
`}return o.trim()+`
`}function Bo(e){const t=[];let o="";for(const n of e.split(`
`)){const i=n.match(/^## (\d{4}-\d{2}-\d{2})/);if(i){o=i[1];continue}const r=n.match(/^- (FIX|PATTERN|GOTCHA|TRIED|WORKS): (.+)$/);r&&o&&t.push({date:o,type:r[1],content:r[2].trim()})}return t}function Mr(e,t,o){const n=new Date().toISOString().slice(0,10);return[...e,{date:n,type:t,content:o}]}function Pr(e){if(!e)return null;const t=e.replace(/\s+/g," ").trim();if(!t)return null;const o=a=>a.length>160?a.slice(0,157)+"…":a;if(/React is not defined/i.test(t)||/import React from ['"]react['"]/i.test(t))return"Default `import React from 'react'` breaks in this ESM build — use named hook imports (e.g. `import { useState } from 'react'`).";const n=t.match(/(\b[\w$]+) is not defined/);if(n)return o(`"${n[1]}" was used before being declared or imported — define/import it before use.`);const i=t.match(/(?:Cannot find module|Could not resolve|Failed to resolve(?: import)?) ['"]([^'"]+)['"]/);if(i)return o(`Package "${i[1]}" isn't importable — only the curated allowlist is available; build the feature with inline SVG/CSS instead.`);const r=t.match(/Cannot read propert(?:y|ies) of (?:undefined|null) \(reading ['"]([^'"]+)['"]\)/);if(r)return o(`Read ".${r[1]}" off undefined/null — guard the value (optional chaining or a default) before accessing it.`);if(/Maximum update depth|Too many re-renders/i.test(t))return"Infinite render loop — never call setState during render; move it into an event handler or a useEffect with correct deps.";const l=t.match(/(\b[\w$.]+) is not a function/);if(l)return o(`"${l[1]}" is not a function — check the import/destructure and that the value is what you expect.`);const h=t.match(/(Unexpected token[^.]*|Unterminated[^.]*|Expected [^.]*)/);return h?o(`Syntax error: ${h[1].trim()} — check brackets, JSX tags, and string quoting near the reported line.`):null}function $r(e,t=40){const o=r=>r.toLowerCase().replace(/[`"'.]/g,"").replace(/\s+/g," ").trim(),n=new Map;for(const r of e){const l=o(r.content);if(!l)continue;const h=n.get(l);(!h||r.date>=h.date)&&n.set(l,r)}return[...n.values()].sort((r,l)=>r.date===l.date?0:r.date<l.date?-1:1).slice(-t)}function Or(e){if(e.length===0)return"";const t=e.slice(-20),o=new Date().toISOString().slice(0,10),n=t.filter(l=>l.date===o),i=t.filter(l=>l.date!==o);let r=`<system-reminder>
`;if(r+=`## Agent Lessons Learned

`,n.length>0){r+=`**Today's learnings:**
`;for(const l of n)r+=`- ${l.type}: ${l.content}
`;r+=`
`}if(i.length>0){r+=`**Previous sessions:**
`;for(const l of i.slice(-10))r+=`- ${l.type}: ${l.content}
`}return r+=`
Apply these lessons. Do not repeat TRIED/FAILED approaches.
`,r+="</system-reminder>",r}const io=`# OpenThorn Agent — CHANGELOG

> Auto-generated session log. Tracks what was built, what failed, and what worked.
> The agent reads this before new sessions to avoid repeating dead ends.

`;function Dr(e){if(e.length===0)return io;let t=io;for(const o of[...e].reverse()){if(t+=`## ${o.date} — ${o.sessionId}

`,t+=`**Prompt:** ${o.prompt}

`,o.filesCreated.length>0&&(t+=`**Created:** ${o.filesCreated.join(", ")}

`),o.filesEdited.length>0&&(t+=`**Edited:** ${o.filesEdited.join(", ")}

`),o.approaches.length>0){t+=`**Approaches:**
`;for(const n of o.approaches){const i=n.result==="works"?"✅":"❌";t+=`- ${i} ${n.tried}: ${n.note}
`}t+=`
`}if(o.lessons.length>0){t+=`**Lessons:**
`;for(const n of o.lessons)t+=`- ${n}
`;t+=`
`}t+=`---

`}return t.trim()+`
`}function Fo(e){const t=[],o=e.split(/^## /m).slice(1);for(const n of o){const i=n.trim().split(`
`),r=i[0]||"",[l,h]=r.split(" — "),a=(l||"").trim(),m=(h||"").trim();if(!a)continue;const f={date:a,sessionId:m,prompt:"",filesCreated:[],filesEdited:[],approaches:[],lessons:[]};let u="";for(let v=1;v<i.length;v++){const b=i[v];if(b.startsWith("**Prompt:**"))f.prompt=b.replace("**Prompt:**","").trim();else if(b.startsWith("**Created:**"))f.filesCreated=b.replace("**Created:**","").trim().split(",").map(w=>w.trim()).filter(Boolean);else if(b.startsWith("**Edited:**"))f.filesEdited=b.replace("**Edited:**","").trim().split(",").map(w=>w.trim()).filter(Boolean);else if(b.startsWith("**Approaches:**"))u="approaches";else if(b.startsWith("**Lessons:**"))u="lessons";else if(b.startsWith("---"))u="";else if(u==="approaches"&&b.match(/^- [✅❌]/)){const w=b.match(/^- ([✅❌]) (.+?): (.+)$/);w&&f.approaches.push({tried:w[2].trim(),result:w[1]==="✅"?"works":"failed",note:w[3].trim()})}else u==="lessons"&&b.startsWith("- ")&&f.lessons.push(b.replace("- ","").trim())}t.push(f)}return t}function Br(e){return{date:new Date().toISOString().slice(0,10),sessionId:e.sessionId,prompt:e.prompt,filesCreated:e.filesCreated,filesEdited:e.filesEdited,approaches:e.approaches,lessons:e.lessons}}function Fr(e){const t=[];for(const o of e.slice(-5))for(const n of o.approaches)n.result==="failed"&&t.push(`- ❌ ${n.tried}: ${n.note}`);return t.length===0?"":`<system-reminder>
## Previously Failed Approaches (DO NOT RETRY)

${t.join(`
`)}

These approaches were tried and failed. Find a different solution.
</system-reminder>`}function Ur(){const e=new Date,t=e.toISOString().slice(0,10).replace(/-/g,""),o=e.toTimeString().slice(0,5).replace(":",""),n=Math.random().toString(36).slice(2,6);return`${t}-${o}-${n}`}const ro=new Set(["api.openai.com","api.anthropic.com","generativelanguage.googleapis.com","api.deepseek.com","api.mistral.ai","api.groq.com","api.together.xyz","openrouter.ai","api.openrouter.ai","api.x.ai","api.together.ai","api.perplexity.ai","api.fireworks.ai","api.cerebras.ai","api.cohere.com","api.cohere.ai","api.rodiumai.io","api.github.com","models.github.com","localhost","127.0.0.1","bedrock-runtime.us-east-1.amazonaws.com"]),Ot=8192,ao=30,Wr=48e3,Hr=.25,lo=6,qr=6,Gr=500,zr=new Set(["list_files","read_file","search_files","compile"]),At=40,Rt=30,ln=8,co=3,Vr=3e4,Kr=1e3,fn=3e4,mt=3,Jr=2,Yr=4e3;function Xr(e){const t=e.toLowerCase();return!/(claude-fable|claude-mythos|claude-opus-4-[78])/.test(t)}function gn(e){return Array.isArray(e)?e.map(gn):!e||typeof e!="object"?e:Object.fromEntries(Object.entries(e).filter(([t])=>t!=="additionalProperties").map(([t,o])=>[t,gn(o)]))}class Zr{constructor(){dt(this,"state",new Map)}isOpen(t){const o=this.state.get(t);return o?o.openUntil>Date.now()?!0:(o.failures>=co&&this.state.delete(t),!1):!1}recordSuccess(t){this.state.delete(t)}recordFailure(t){const o=this.state.get(t)||{failures:0,lastFail:0,openUntil:0};o.failures++,o.lastFail=Date.now(),o.failures>=co&&(o.openUntil=Date.now()+Vr),this.state.set(t,o)}getStatus(t){const o=this.state.get(t);return o?o.openUntil>Date.now()?"open":o.failures>0?"degraded":"healthy":"healthy"}}const Be=new Zr;function Je(e){const t=Kr*Math.pow(2,e),o=Math.min(t,fn),n=o*.2*(Math.random()*2-1);return Math.round(o+n)}function Ye(e){return new Promise(t=>setTimeout(t,e))}function bn(e){return e===408||e===429||e>=500&&e<600}function vn(e){if(!e)return null;const t=Number(e);if(Number.isFinite(t)&&t>=0)return Math.min(t*1e3,fn);const o=Date.parse(e);return Number.isNaN(o)?null:Math.min(Math.max(o-Date.now(),0),fn)}function wn(){return{inputTokens:0,outputTokens:0,cacheReadTokens:0,cacheWriteTokens:0}}function Qr(e,t){return t?{inputTokens:e.inputTokens+t.inputTokens,outputTokens:e.outputTokens+t.outputTokens,cacheReadTokens:e.cacheReadTokens+t.cacheReadTokens,cacheWriteTokens:e.cacheWriteTokens+t.cacheWriteTokens}:e}function ft(e){if(e!=null&&e.aborted)throw new DOMException("The agent run was cancelled.","AbortError")}function Fe(e){return e.trim().replace(/\\/g,"/").replace(/^\/+/,"")}function ea(e,t){const o=e.toLowerCase().trim();return["tsx","ts","jsx","js","css","json"].includes(o)?o:t.endsWith(".tsx")?"tsx":t.endsWith(".ts")?"ts":t.endsWith(".jsx")?"jsx":t.endsWith(".js")?"js":t.endsWith(".css")?"css":t.endsWith(".json")?"json":"tsx"}function Uo(e){const t=new Map;for(const o of e){const n=Fe(o.path);if(!n)continue;const i=ea(o.language,n);t.set(n,{path:n,language:i,code:o.code.replace(/\r\n/g,`
`)})}return[...t.values()].sort((o,n)=>o.path==="src/App.tsx"?-1:n.path==="src/App.tsx"||o.path==="src/styles/theme.css"?1:n.path==="src/styles/theme.css"?-1:o.path.localeCompare(n.path))}function ta(e,t){const o=Uo([t])[0];if(!o)return e;const n=e.findIndex(i=>i.path===o.path);if(n>=0){const i=[...e];return i[n]=o,i}return[...e,o]}function Wo(e,t){const o=e.length,n=t.length;if(o===0)return n;if(n===0)return o;let i=new Array(n+1),r=new Array(n+1);for(let l=0;l<=n;l++)i[l]=l;for(let l=1;l<=o;l++){r[0]=l;for(let a=1;a<=n;a++){const m=e[l-1]===t[a-1]?0:1;r[a]=Math.min(r[a-1]+1,i[a]+1,i[a-1]+m)}const h=i;i=r,r=h}return i[n]}function Lt(e,t,o=3){return t.map(n=>({path:n.path,dist:Wo(e,n.path)})).filter(n=>n.dist>0&&n.dist<=o).sort((n,i)=>n.dist-i.dist).slice(0,3).map(n=>n.path)}function na(e){let t="^",o=0;for(;o<e.length;)if(e[o]==="*"&&e[o+1]==="*")t+=".*",o+=2,e[o]==="/"&&(o+=1);else if(e[o]==="*")t+="[^/]*",o+=1;else if(e[o]==="?")t+="[^/]",o+=1;else{const n=e[o];".+^${}()|[]\\".includes(n)?t+="\\"+n:t+=n,o+=1}return t+="$",new RegExp(t)}function oa(e,t){const o=t.trim().replace(/^['"]+|['"]+$/g,"").replace(/^\.\//,"");if(!o)return!1;try{const n=na(o);if(n.test(e))return!0;if(!o.includes("/")){const i=e.split("/").pop()??e;return n.test(i)}return!1}catch{return!1}}function sa(e,t){const o=e.split(`
`);let n=t.split(`
`);if(n.length>1&&n[n.length-1]===""&&(n=n.slice(0,-1)),n.length===0)return null;const i=n.map(l=>l.trim());if(i.every(l=>l===""))return null;const r=[];for(let l=0;l+i.length<=o.length;l++){let h=!0;for(let a=0;a<i.length;a++)if(o[l+a].trim()!==i[a]){h=!1;break}if(h&&(r.push({start:l,end:l+i.length-1}),r.length>1))return null}return r.length===1?r[0]:null}function uo(e,t,o){if(!t)return{ok:!1,reason:"EMPTY_OLD_STRING"};if(t===o)return{ok:!1,reason:"IDENTICAL_STRINGS"};const n=e.split(t).length-1;if(n>1)return{ok:!1,reason:"MULTIPLE_MATCHES",count:n};if(n===1)return{ok:!0,code:e.replace(t,o),fuzzy:!1};const i=sa(e,t);if(!i)return{ok:!1,reason:"STRING_NOT_FOUND"};const r=e.split(`
`);return{ok:!0,code:[...r.slice(0,i.start),...o.split(`
`),...r.slice(i.end+1)].join(`
`),fuzzy:!0}}function ia(e,t){const o=e.split(`
`),n=t.split(`
`),i=(n.find(f=>f.trim().length>3)??n[0]??"").trim();if(!i)return null;let r=-1,l=1/0;for(let f=0;f<o.length;f++){const u=o[f].trim();if(!u)continue;const v=Wo(i,u);if(v<l&&(l=v,r=f),v===0)break}if(r<0||l>Math.max(4,Math.floor(i.length*.45)))return null;const h=Math.max(0,r-2),a=Math.min(o.length,r+Math.max(n.length,1)+2),m=o.slice(h,a).map((f,u)=>`${String(h+u+1).padStart(4," ")}  ${f}`).join(`
`);return{start:h+1,end:a,text:m}}function po(e,t,o,n,i){switch(e){case"EMPTY_OLD_STRING":return Y({code:"EMPTY_OLD_STRING",message:"old_string must not be empty.",suggestion:"Provide the exact text to replace, copied from the file."});case"IDENTICAL_STRINGS":return Y({code:"IDENTICAL_STRINGS",message:"old_string and new_string are identical.",suggestion:"The replacement must differ from the original."});case"MULTIPLE_MATCHES":return Y({code:"MULTIPLE_MATCHES",message:`old_string appears ${n??"multiple"} times in ${t}. It must be unique.`,suggestion:"Include more surrounding context lines to make it unique."});case"STRING_NOT_FOUND":{const r=i?ia(o,i):null,l=r?`Closest matching text currently in ${t} (lines ${r.start}-${r.end}) — copy from here exactly:
${r.text}`:`The file starts with:
${o.split(`
`).slice(0,5).join(`
`)}`;return Y({code:"STRING_NOT_FOUND",message:`old_string not found in ${t} (tried exact and whitespace-tolerant matching).`,suggestion:`${l}

Copy the current text exactly (including indentation), or use write_file to replace the whole file if the section is large.`})}}}function Y(e){const t=[`Error [${e.code}]: ${e.message}`];return e.suggestion&&t.push(`Suggestion: ${e.suggestion}`),e.similarPaths&&e.similarPaths.length>0&&t.push(`Similar files: ${e.similarPaths.join(", ")}`),t.join(`
`)}const ra=/^(continue|keep going|go on|resume|carry on|proceed|finish|finish it|finish this|keep working)$/;function aa(e){return ra.test(e.toLowerCase().replace(/[.!?]+/g,"").replace(/\s+/g," ").trim())}function Ho(e){const t=e.toLowerCase().replace(/\s+/g," ").trim();return t.startsWith("[visual edit]")?!0:!t||t.length>220||/\b(rebuild|redesign|rewrite|replace everything|from scratch|entire app|whole file)\b/.test(t)?!1:/\b(add|change|fix|improve|move|remove|replace|update)\b/.test(t)}const la=/\b(rebuild|redesign|rewrite|recreate|overhaul|from scratch|start over)\b/i;function ca(e,t){const o=l=>{const h=l.trim();return h.length>4&&!/^[{}()[\];,]+$/.test(h)},n=e.split(`
`).map(l=>l.trim()).filter(o);if(n.length===0)return 0;const i=new Set(t.split(`
`).map(l=>l.trim()));let r=0;for(const l of n)i.has(l)&&r++;return r/n.length}function da(e){if(e.mode!=="refine"||e.alreadyRejected)return!1;const t=e.existingCode.split(`
`).length,o=e.newCode.split(`
`).length;return t<160||o<120||o<t*.65?!1:Ho(e.prompt)?!0:la.test(e.prompt)?!1:ca(e.existingCode,e.newCode)>=.55}function ua(e){let t=0;for(const o of e){if(o.reasoningContent&&(t+=o.reasoningContent.length),typeof o.content=="string"){t+=o.content.length;continue}for(const n of o.content)n.text&&(t+=n.text.length),n.content&&(t+=n.content.length),n.thinking&&(t+=n.thinking.length),n.input&&(t+=JSON.stringify(n.input).length)}return Math.ceil(t/4)}function pa(e,t){const o=t&&t>0?t:$s(e),n=Math.min(o*Hr,Wr);return Math.max(Math.round(o-n),8e3)}function ha(e,t){const o=[];for(let l=0;l<e.length;l++)e[l].role==="assistant"&&o.push(l);const n=o.length;if(n<=lo+1)return{messages:e,compacted:!1};if(ua(e)<=t)return{messages:e,compacted:!1};const i=n-lo;let r=!1;for(let l=0;l<i;l++){const h=o[l],a=h+1;if(a<e.length&&e[a].role==="user"&&Array.isArray(e[a].content)){const f=e[a].content.map(u=>{if(u.type!=="tool_result")return u;let v="";if(Array.isArray(e[h].content)){const b=e[h].content.find(w=>w.type==="tool_use"&&w.id===u.tool_use_id);b&&(v=b.name??"")}return zr.has(v)?(r=!0,{...u,content:"[tool output truncated — current file state is tracked in the workspace]"}):u});e[a]={role:"user",content:f}}}return{messages:e,compacted:r}}function ma(e,t,o){var m,f;const n=[],i=[];for(const u of e)if(u.role==="assistant"&&Array.isArray(u.content))for(const v of u.content)v.type==="tool_use"&&(v.name==="write_file"&&((m=v.input)!=null&&m.path)?n.push(String(v.input.path)):v.name==="edit_file"&&((f=v.input)!=null&&f.path)&&i.push(String(v.input.path)));const r=u=>[...new Set(u)],l=[lr,"","## Progress Summary",`- **Turns executed:** ${o}`,`- **Files in project:** ${t.length}`],h=r(n);h.length>0&&l.push(`- **Files created:** ${h.join(", ")}`);const a=r(i);return a.length>0&&l.push(`- **Files edited:** ${a.join(", ")}`),l.push("","Continue from where you left off. Current file state is accurate."),l.join(`
`)}class fa{constructor(){dt(this,"actions",[]);dt(this,"errors",[]);dt(this,"lastNudgeTurn",0)}fingerprint(t,o){if(t==="read_file")return`${t}:${String(o.path??"")}`;const n=t==="edit_file"||t==="multi_edit"||t==="write_file"?String(o.path??"")+"|"+String(o.old_string??"").slice(0,80):JSON.stringify(o).slice(0,120);return`${t}:${n}`}record(t,o,n){for(const a of o)a.isError&&this.actions.push(this.fingerprint(a.name,a.input));for(const a of n)this.errors.push(a.slice(0,120));if(this.actions=this.actions.slice(-8),this.errors=this.errors.slice(-6),t-this.lastNudgeTurn<2)return null;const i=new Map;for(const a of this.actions)i.set(a,(i.get(a)??0)+1);const r=[...i.entries()].find(([,a])=>a>=3);if(r)return this.lastNudgeTurn=t,`You have repeated the same failing action (${r[0].split(":")[0]}) ${r[1]} times without progress.`;const l=new Map;for(const a of this.errors)l.set(a,(l.get(a)??0)+1);const h=[...l.entries()].find(([,a])=>a>=3);return h?(this.lastNudgeTurn=t,`The same error keeps occurring: "${h[0]}".`):null}}async function ga(e){var ye,Ue,Ze,Ne,We,oe,Ce,be,ce,me,Qe,Ie,gt,re,Ee,yt,Ae,et,tt;const t=Ur();let o=await yo(e.userId,e.selectedModel??null),n=o.key.provider_name||((ye=e.selectedModel)==null?void 0:ye.provider_name)||o.key.provider_id,i=((Ue=e.selectedModel)==null?void 0:Ue.model_name)||o.model.name||o.model.id;(Ze=e.onProgress)==null||Ze.call(e,{type:"status",message:`Connected to ${n} / ${i}`});const r=await ya(e.userId,e.files);r&&((Ne=e.onProgress)==null||Ne.call(e,{type:"status",message:"Loaded agent memory."}));for(const fe of Rr(e.prompt))oo(e.userId,"preference",fe);const l=Ar(mn(e.userId)),{data:h}=await F.from("profiles").select("custom_instructions").eq("id",e.userId).single(),a=((We=h==null?void 0:h.custom_instructions)==null?void 0:We.trim())??"",m=e.files.length===0||e.files[0].path==="No files yet",f=e.mode??"create",u=Bt(e.thinkingLevel),v=yn[u],b=f==="refine"&&Ho(e.prompt),w=!!(e.hasBackend&&e.projectId),{tools:_,expanded:A}=Vi({mode:f,isNewProject:m,prompt:e.prompt,smallRefine:b,hasBackend:w}),k=[];r&&k.push({role:"user",content:r}),l&&k.push({role:"user",content:l}),a&&k.push({role:"user",content:`<user-knowledge>
The user has set the following custom instructions that apply to every project. Follow them unless they conflict with explicit instructions in the current request:

${a}
</user-knowledge>`}),k.push({role:"user",content:ir(u)}),A||k.push({role:"user",content:b?Ji:Ki}),w?k.push({role:"user",content:Yi}):k.push({role:"user",content:Xi}),(m||f==="create")&&k.push({role:"user",content:nr});let j=Uo(e.files);const I=k.length;if(e.history&&e.history.length>0&&f==="refine")for(const fe of e.history)if(typeof fe.content=="string")k.push({role:fe.role,content:fe.content});else{const Re=fe.content.filter(de=>de.type!=="thinking"&&de.type!=="image");Re.length>0&&k.push({role:fe.role,content:Re})}k.push({role:"user",content:Da(e.prompt,e.title,e.files,f,m,b)});let S=0,N=0,L=wn();const H=new Set;let $=0,P=0;const R=new fa,C={mode:f,smallRefine:b,goal:e.prompt,turn:0,reads:new Map,mutatedPaths:new Set,rewriteGuardedPaths:new Set,dirtySinceCompile:!0,lastCompileOk:!1,doneRejections:0,pendingErrorLessons:[],recoveredLessons:[],backend:e.hasBackend&&e.projectId?{projectId:e.projectId,config:e.backendConfig}:void 0};e.history&&e.history.length>0&&f==="refine"&&va(C,e.history,j);const D=[],te=[];let ne=!1,X=!1;for(;S<(e.maxTurns??v.maxTurns??ao);){if(ft(e.signal),S++,ha(k,pa(o.key.provider_id,o.model.contextWindow)).compacted){if(C.reads.clear(),S-N>=qr){const M=ma(k,j,S);k.push({role:"user",content:M}),N=S}(oe=e.onProgress)==null||oe.call(e,{type:"compaction",message:"Context compacted to save tokens."})}const Re=sr({mode:f,turnCount:S,thinkingLevel:u,hasPendingErrors:C.pendingErrorLessons.length>0});let de;try{(Ce=e.onProgress)==null||Ce.call(e,{type:"generating"}),de=await ka({providerId:o.key.provider_id,baseUrl:o.baseUrl,apiKey:o.key.api_key,modelId:o.model.id,system:tr,tools:_,messages:k,signal:e.signal,onText:M=>{var q;(q=e.onProgress)==null||q.call(e,{type:"text",text:M})},onToolStream:_a(e.onProgress),thinkingBudget:Re}),Be.recordSuccess(o.key.provider_id)}catch(M){if(M instanceof DOMException&&M.name==="AbortError"||(Be.recordFailure(o.key.provider_id),H.add(o.key.provider_id),$>=Jr))throw M;let q;try{q=await yo(e.userId,null,H)}catch{throw M}$++,o=q,n=q.key.provider_name||q.key.provider_id,i=q.model.name||q.model.id;const W=M instanceof Error?M.message:String(M);(be=e.onProgress)==null||be.call(e,{type:"status",message:`Provider failed (${W}) — switched to ${n} / ${i}.`}),S--;continue}const{text:nt,toolCalls:ue,thinkingBlocks:ot,usage:bt,invalidCalls:ve}=de;bt&&(L=Qr(L,bt),(ce=e.onProgress)==null||ce.call(e,{type:"usage",usage:L}));const pe=[];for(const M of ot??[])pe.push({type:"thinking",thinking:M.thinking,signature:M.signature});nt&&pe.push({type:"text",text:nt});for(const M of ue)pe.push({type:"tool_use",id:M.id,name:M.name,input:M.input,thoughtSignature:M.thoughtSignature});for(const M of ve??[])pe.push({type:"tool_use",id:M.id,name:M.name,input:{}});if(pe.length>0){const M={role:"assistant",content:pe};de.reasoningContent&&(M.reasoningContent=de.reasoningContent),k.push(M),P=0}else{if(P++,P>=2)break;k.push({role:"user",content:"Your last response was empty — no text and no tool calls. Continue the task with the next tool call, or call done if the project is compiled, verified, and complete."});continue}if(ue.length===0&&((ve==null?void 0:ve.length)??0)===0&&nt){if(!X)return Be.recordSuccess(o.key.provider_id),(me=e.onProgress)==null||me.call(e,{type:"done",files:j,filesMutated:!1}),{files:j,turns:S,providerName:n,modelName:i,usage:L,filesMutated:!1,conversationHistory:k.slice(I)};k.push({role:"user",content:ne?"You modified files this run but ended your response without any tool call. Continue: compile to verify the current files, finish any remaining plan items, then call done.":"This is a build/refine request, but you stopped after reading or planning. Continue with the next concrete tool action now: use edit_file or multi_edit for the requested change, then compile and call done."});continue}C.turn=S;const we=await ba(ue,j,e.signal,e.onProgress,o,C);let _e=!1;for(let M=0;M<ue.length;M++){const q=ue[M];if(q.name==="write_file"&&((Qe=q.input)!=null&&Qe.path)){const W=String(q.input.path);D.includes(W)||D.push(W)}if(q.name==="edit_file"&&((Ie=q.input)!=null&&Ie.path)){const W=String(q.input.path);te.includes(W)||te.push(W)}["write_file","edit_file","multi_edit","delete_file"].includes(q.name)&&!((gt=we[M])!=null&&gt.isError)&&(ne=!0,_e=!0,X=!0),q.name==="set_title"&&!((re=we[M])!=null&&re.isError)&&(X=!0)}let Le=!1,ie=null,ae=null;for(let M=0;M<we.length;M++){const q=ue[M],W=we[M];if(W.files&&(j=W.files),q.name==="done"&&!W.isError){Le=!0,ie=W,ae=q.id;continue}q.name==="done"&&W.isError&&((Ee=e.onProgress)==null||Ee.call(e,{type:"status",message:"Verification gate rejected done — continuing until the app is verified."})),k.push({role:"user",content:[{type:"tool_result",tool_use_id:q.id,content:W.content,is_error:W.isError}]})}_e&&!Le&&((yt=e.onProgress)==null||yt.call(e,{type:"files",files:j,filesMutated:!0}));for(const M of ve??[])k.push({role:"user",content:[{type:"tool_result",tool_use_id:M.id,content:Y({code:"MALFORMED_TOOL_ARGS",message:`The arguments for your ${M.name} call were not valid JSON and could not be parsed.`,suggestion:`Re-issue the ${M.name} call with well-formed JSON arguments. The raw arguments started with: ${M.raw.slice(0,200)}`}),is_error:!0}]});const Me=we.filter(M=>M.isError).map(M=>M.content),st=R.record(S,ue.map((M,q)=>{var W;return{name:M.name,input:M.input,isError:((W=we[q])==null?void 0:W.isError)??!1}}),Me);st&&((Ae=e.onProgress)==null||Ae.call(e,{type:"status",message:"Detected a stuck loop — nudging a new approach."}),k.push({role:"user",content:rr(st)}));const He=(e.maxTurns??v.maxTurns??ao)-S;if(!Le&&(He===6||He===3)&&k.push({role:"user",content:ar(He)}),Le&&ie)return k.push({role:"user",content:[{type:"tool_result",tool_use_id:ae??"done",content:ie.content,is_error:!1}]}),fo(j,C.recoveredLessons),await ho(e.userId,j,{sessionId:t,prompt:e.prompt,filesCreated:D,filesEdited:te,approaches:[],lessons:C.recoveredLessons}),f==="create"&&oo(e.userId,"fact",`Built: ${e.title||e.prompt.slice(0,60)}`),Be.recordSuccess(o.key.provider_id),(et=e.onProgress)==null||et.call(e,{type:"done",files:j,filesMutated:ne}),{files:j,turns:S,providerName:n,modelName:i,usage:L,filesMutated:ne,conversationHistory:k.slice(I)}}return fo(j,C.recoveredLessons),await ho(e.userId,j,{sessionId:t,prompt:e.prompt,filesCreated:D,filesEdited:te,approaches:[],lessons:C.recoveredLessons}),Be.recordSuccess(o.key.provider_id),(tt=e.onProgress)==null||tt.call(e,{type:"done",files:j,filesMutated:ne}),{files:j,turns:S,providerName:n,modelName:i,usage:L,filesMutated:ne,conversationHistory:k.slice(I)}}async function ya(e,t){const o=[],n=t.find(r=>r.path==="src/lib/lessons.md");if(n){const r=Bo(n.code),l=Or(r);l&&o.push(l)}const i=t.find(r=>r.path==="src/lib/CHANGELOG.md");if(i){const r=Fo(i.code),l=Fr(r);l&&o.push(l)}return o.join(`

`)}async function ho(e,t,o){const n=t.find(a=>a.path==="src/lib/CHANGELOG.md"),i=n?Fo(n.code):[],r=Br(o);i.push(r);const l=i.slice(-20),h=Dr(l);n?n.code=h:t.push({path:"src/lib/CHANGELOG.md",language:"md",code:h})}function mo(e,t){const o=Pr(t??"");o&&(e.pendingErrorLessons.includes(o)||e.recoveredLessons.includes(o)||e.pendingErrorLessons.push(o))}function fo(e,t){if(t.length===0)return;const o=e.find(r=>r.path==="src/lib/lessons.md");let n=o?Bo(o.code):[];for(const r of t)n=Mr(n,"GOTCHA",r);n=$r(n);const i=Lr(n);o?o.code=i:e.push({path:"src/lib/lessons.md",language:"md",code:i})}async function ba(e,t,o,n,i,r){var v;if(e.length===0)return[];const l=[],h=[],a=[],m=[];for(let b=0;b<e.length;b++){const w=e[b];switch(Qi[w.name]??"read"){case"read":l.push({index:b,call:w});break;case"write":h.push({index:b,call:w});break;case"compile":a.push({index:b,call:w});break;case"done":m.push({index:b,call:w});break}}const f=new Array(e.length).fill(null),u=[...l];if(u.length>0){const b=await Promise.all(u.map(({index:w,call:_})=>(n==null||n({type:"tool_start",toolName:_.name,toolCallId:_.id,toolInput:_.input}),cn(_,t,o,i,n,r).then(A=>(n==null||n({type:"tool_result",toolName:_.name,toolCallId:_.id,toolInput:_.input,toolResult:A.content,toolError:A.isError,files:A.files}),{index:w,result:A})))));for(const{index:w,result:_}of b)f[w]=_,_.files&&(t=_.files)}for(const{index:b,call:w}of h){n==null||n({type:"tool_start",toolName:w.name,toolCallId:w.id,toolInput:w.input});const _=await cn(w,t,o,i,n,r);n==null||n({type:"tool_result",toolName:w.name,toolCallId:w.id,toolInput:w.input,toolResult:_.content,toolError:_.isError,files:_.files}),f[b]=_,_.files&&(t=_.files,_.isError||(r.dirtySinceCompile=!0,r.lastPreviewHtml=void 0,(v=w.input)!=null&&v.path&&r.mutatedPaths.add(Fe(String(w.input.path)))))}for(const{index:b,call:w}of[...a,...m]){n==null||n({type:"tool_start",toolName:w.name,toolCallId:w.id,toolInput:w.input});const _=await cn(w,t,o,i,n,r);n==null||n({type:"tool_result",toolName:w.name,toolCallId:w.id,toolInput:w.input,toolResult:_.content,toolError:_.isError,files:_.files}),f[b]=_,_.files&&(t=_.files)}return f.filter(b=>b!==null).map(b=>({...b,content:Zi(b.content)}))}function Dt(e){return`${e.length}:${e.slice(0,80)}`}function pt(e,t,o,n,i){if(!e)return;const r=Dt(o),l=e.reads.get(t);l&&l.snap===r?n<=l.servedEnd+1&&i>=l.servedStart-1?e.reads.set(t,{snap:r,turn:e.turn,servedStart:Math.min(l.servedStart,n),servedEnd:Math.max(l.servedEnd,i)}):e.reads.set(t,{snap:r,turn:e.turn,servedStart:n,servedEnd:i}):e.reads.set(t,{snap:r,turn:e.turn,servedStart:n,servedEnd:i})}function va(e,t,o){var i,r;const n=new Map(o.map(l=>[l.path,l]));for(const l of t)if(!(l.role!=="assistant"||!Array.isArray(l.content)))for(const h of l.content){if(h.type!=="tool_use"||h.name!=="write_file")continue;const a=typeof((i=h.input)==null?void 0:i.path)=="string"?h.input.path:"",m=typeof((r=h.input)==null?void 0:r.content)=="string"?h.input.content:"";if(!a||!m)continue;const f=n.get(a);!f||Dt(f.code)!==Dt(m)||pt(e,a,f.code,1,f.code.split(`
`).length)}}async function cn(e,t,o,n,i,r){var l,h;switch(ft(o),e.name){case"think":return{content:String(e.input.thought??""),isError:!1};case"list_files":{if(t.length===0)return{content:"No files in the project yet.",isError:!1};const a=[...t].sort((v,b)=>v.path.localeCompare(b.path)),m=a.length>At,u=(m?a.slice(0,At):a).map(v=>`  ${v.path}  (${v.language}, ${v.code.split(`
`).length} lines)`).join(`
`);return{content:`${t.length} files${m?` (showing first ${At})`:""}:
${u}${m?`
... and ${t.length-At} more. Use search_files or read specific paths.`:""}`,isError:!1}}case"read_file":{const a=Fe(String(e.input.path??"")),m=Math.max(1,Number(e.input.offset)||1),f=Number(e.input.limit)||Gr,u=t.find(I=>I.path===a);if(!u){const I=Lt(a,t);return{content:Y({code:"FILE_NOT_FOUND",message:`File not found: ${a}`,suggestion:"Use list_files to see all project files. Check the path spelling.",similarPaths:I.length>0?I:void 0}),isError:!0}}const v=u.code.split(`
`),b=m-1,w=Math.min(b+f,v.length),_=Dt(u.code);if(r){const I=r.reads.get(a),S=w,N=I&&I.snap===_&&I.servedStart<=1&&I.servedEnd>=v.length,L=I&&I.snap===_&&m>=I.servedStart&&S<=I.servedEnd;if(N||L)return{content:`You already have ${a} (lines ${I.servedStart}-${I.servedEnd}) — it was read or written earlier in this conversation and has not changed since, so its full content is still in the transcript above. Do not read it again. Make your edit now, or use search_files with context_lines to jump to a specific section.`,isError:!1};pt(r,a,u.code,m,w)}const k=v.slice(b,w).map((I,S)=>`${String(b+S+1).padStart(4," ")}  ${I}`).join(`
`);let j=`File: ${a} (${v.length} lines total)`;return(b>0||w<v.length)&&(j+=`, showing lines ${b+1}-${w}`),b>0&&(j+=`
[... ${b} lines before ...]`),j+=`
${k}`,w<v.length&&(j+=`
[... ${v.length-w} lines after ...]`,j+=`
[Tip: Use offset=${w+1} to read the next ${f} lines]`),{content:j,isError:!1}}case"search_files":{const a=String(e.input.pattern??""),m=e.input.glob?String(e.input.glob):void 0,f=e.input.output_mode||"content",u=Math.max(0,Number(e.input.context_lines)||0);if(!a.trim())return{content:Y({code:"INVALID_PATTERN",message:"Search pattern must not be empty.",suggestion:'Provide a regex pattern to search for, e.g. "import.*from"'}),isError:!0};let v;try{v=new RegExp(a,"gi")}catch{return{content:Y({code:"INVALID_REGEX",message:`Invalid regex pattern: ${a}`,suggestion:"Check your regex syntax. Escape special characters like ( [ { . * + ? ^ $ | \\\\."}),isError:!0}}const b=m?t.filter(k=>oa(k.path,m)):t;if(b.length===0)return{content:m?`No files matched the glob pattern "${m}".`:"No files in the project.",isError:!1};if(f==="count"){const k=[];let j=0;for(const I of b){let S=0;for(const N of I.code.split(`
`)){const L=N.match(v);L&&(S+=L.length)}S>0&&(k.push(`  ${I.path}: ${S} match(es)`),j+=S)}return{content:k.length>0?`${j} total match(es) across ${k.length} file(s):
${k.join(`
`)}`:`No matches for "${a}" in ${b.length} file(s).`,isError:!1}}if(f==="files_with_matches"){const k=[];for(const j of b)v.test(j.code)&&(k.push(`  ${j.path}`),v.lastIndex=0);return{content:k.length>0?`${k.length} file(s) matched:
${k.join(`
`)}`:`No files matched "${a}" in ${b.length} file(s).`,isError:!1}}const w=[];let _=0;for(const k of b){const j=k.code.split(`
`),I=[];for(let S=0;S<j.length&&!(v.test(j[S])&&(I.push({lineNum:S+1,line:j[S]}),v.lastIndex=0,_++,_>=Rt));S++);if(I.length>0){w.push(`── ${k.path} (${I.length} match(es)) ──`);const S=new Set;for(const N of I){const L=Math.max(1,N.lineNum-u),H=Math.min(j.length,N.lineNum+u);if(u>0&&L<N.lineNum)for(let $=L;$<N.lineNum;$++)S.has($)||(w.push(`  ${String($).padStart(4," ")}  ${j[$-1]}`),S.add($));if(w.push(` ▶${String(N.lineNum).padStart(4," ")}  ${N.line}`),S.add(N.lineNum),u>0&&H>N.lineNum)for(let $=N.lineNum+1;$<=H;$++)S.has($)||(w.push(`  ${String($).padStart(4," ")}  ${j[$-1]}`),S.add($))}}if(_>=Rt)break}if(w.length===0)return{content:`No matches for "${a}" in ${b.length} file(s).`,isError:!1};let A=`Found ${_} match(es) for "${a}"`;return _>=Rt&&(A+=` (truncated at ${Rt} — narrow your pattern or use glob to filter)`),{content:`${A}:

${w.join(`
`)}`,isError:!1}}case"set_schema":{if(!((l=r==null?void 0:r.backend)!=null&&l.projectId))return{content:"No Supabase backend is connected to this project. Ask the user to connect one via the Backend button, then retry set_schema.",isError:!0};const a=Array.isArray(e.input.tables)?e.input.tables:[];if(a.length===0)return{content:"set_schema requires at least one table.",isError:!0};try{const{data:{session:m}}=await F.auth.getSession();if(!m)return{content:"Not signed in — cannot apply schema.",isError:!0};const{applySchema:f}=await Os(async()=>{const{applySchema:b}=await Promise.resolve().then(()=>oi);return{applySchema:b}},void 0),u=await f(m.access_token,r.backend.projectId,{tables:a});return{content:`${u.alreadyApplied?"Schema already up to date (no changes applied).":`Schema applied: ${u.statements} statement(s) run against your database. Tables now have row-level security enabled.`}

TypeScript types for your tables:

${u.types}

Use the data client in your app: import { db, auth } from '@openthorn/db'. Read/write with db.from('<table>').select() / .insert({...}) / .update({...}).eq('id', id) / .delete().eq('id', id) — never pass user_id, it defaults to the signed-in user. Build sign-in/up/out UI with auth.signInWithPassword / auth.signUp / auth.signOut and gate writes behind a session.`,isError:!1}}catch(m){return{content:`Could not apply schema: ${m instanceof Error?m.message:"Migration failed"}`,isError:!0}}}case"write_file":{const a=Fe(String(e.input.path??"")),m=String(e.input.language??"tsx"),f=String(e.input.code??"");if(!f.trim())return{content:Y({code:"EMPTY_FILE",message:"File code must not be empty.",suggestion:"Provide complete, valid code for the file. Use edit_file for small changes."}),isError:!0};if(!a.startsWith("src/"))return{content:Y({code:"INVALID_PATH",message:`File path must be under src/. Got: ${a}`,suggestion:"All project files must be under the src/ directory."}),isError:!0};if(a.includes(".."))return{content:Y({code:"PATH_TRAVERSAL",message:`Path traversal not allowed: ${a}`,suggestion:"Use a path under src/ without .. segments."}),isError:!0};const u=t.find(k=>k.path===a);if(r&&u&&da({mode:r.mode,prompt:r.goal,existingCode:u.code,newCode:f,alreadyRejected:r.rewriteGuardedPaths.has(a)}))return r.rewriteGuardedPaths.add(a),{content:Y({code:"WHOLE_FILE_REWRITE_REJECTED",message:`write_file would overwrite most of the long existing file ${a} when the changes are localized.`,suggestion:"Use multi_edit to patch only the specific lines that change (imports, state, handlers, JSX, styles) in one atomic call, instead of regenerating the whole file and risking dropping working code. If the targeted edits genuinely fail after reading the relevant section, you may try write_file again."}),isError:!0};const v=dr(m,f),b=v.code,w=!u,_=ta(t,{path:a,language:m,code:b});pt(r,a,b,1,b.split(`
`).length);const A=v.removedImports.length>0?` Cleaned up unused import(s): ${v.removedImports.join(", ")}.`:"";return{content:`${w?"Created":"Overwrote"} ${a} (${b.split(`
`).length} lines, ${b.length} chars).${A}`,isError:!1,files:_}}case"edit_file":{const a=Fe(String(e.input.path??"")),m=String(e.input.old_string??""),f=String(e.input.new_string??""),u=t.find(w=>w.path===a);if(!u){const w=Lt(a,t);return{content:Y({code:"FILE_NOT_FOUND",message:`File not found: ${a}`,suggestion:"Use list_files to see what exists. Check the path spelling.",similarPaths:w.length>0?w:void 0}),isError:!0}}const v=uo(u.code,m,f);if(!v.ok)return{content:po(v.reason,a,u.code,v.count,m),isError:!0};const b=t.map(w=>w.path===a?{...w,code:v.code}:w);return pt(r,a,v.code,1,v.code.split(`
`).length),{content:`Edited ${a}: replaced ${m.length} chars with ${f.length} chars${v.fuzzy?" (matched ignoring whitespace)":""}.
Preview: ${f.slice(0,200)}${f.length>200?"...":""}`,isError:!1,files:b}}case"multi_edit":{const a=Fe(String(e.input.path??"")),m=Array.isArray(e.input.edits)?e.input.edits:[],f=t.find(w=>w.path===a);if(!f){const w=Lt(a,t);return{content:Y({code:"FILE_NOT_FOUND",message:`File not found: ${a}`,suggestion:"Use list_files to see what exists. Check the path spelling.",similarPaths:w.length>0?w:void 0}),isError:!0}}if(m.length===0)return{content:Y({code:"NO_EDITS",message:"multi_edit requires a non-empty edits array.",suggestion:"Provide at least one {old_string, new_string} edit, or use edit_file."}),isError:!0};let u=f.code,v=0;for(let w=0;w<m.length;w++){const _=m[w],A=String((_==null?void 0:_.old_string)??""),k=String((_==null?void 0:_.new_string)??""),j=uo(u,A,k);if(!j.ok)return{content:`multi_edit failed on edit ${w+1} of ${m.length} — no changes were applied to ${a}.
`+po(j.reason,a,u,j.count,A),isError:!0};u=j.code,j.fuzzy&&v++}const b=t.map(w=>w.path===a?{...w,code:u}:w);return pt(r,a,u,1,u.split(`
`).length),{content:`Applied ${m.length} edit(s) to ${a}${v>0?` (${v} matched ignoring whitespace)`:""}. File is now ${u.split(`
`).length} lines.`,isError:!1,files:b}}case"delete_file":{const a=Fe(String(e.input.path??""));if(!t.find(u=>u.path===a)){const u=Lt(a,t);return{content:Y({code:"FILE_NOT_FOUND",message:`File not found: ${a}`,suggestion:"Use list_files to see what exists. It may already be deleted.",similarPaths:u.length>0?u:void 0}),isError:!0}}if(a==="src/App.tsx")return{content:Y({code:"PROTECTED_FILE",message:"src/App.tsx is the entry point and cannot be deleted.",suggestion:"Overwrite it with write_file instead if you need to change it."}),isError:!0};const f=t.filter(u=>u.path!==a);return{content:`Deleted ${a}. ${f.length} file(s) remain. Compile to confirm nothing still imports it.`,isError:!1,files:f}}case"compile":{if(t.length===0)return{content:"No files to compile. Create some files first.",isError:!1};try{const a=await ht(t.map(v=>({path:v.path,content:v.code})),void 0,(h=r==null?void 0:r.backend)!=null&&h.config?{backend:r.backend.config}:void 0);if(a.errors.length===0){const v=await Po(a.html),b=$o(v);if(!v.ok)return r&&(r.lastCompileOk=!1,mo(r,b)),{content:`Build succeeded, but the app crashes at runtime.

${b}`,isError:!0};if(r&&(r.lastCompileOk=!0,r.dirtySinceCompile=!1,r.lastPreviewHtml=a.html,r.pendingErrorLessons.length>0)){for(const j of r.pendingErrorLessons)r.recoveredLessons.includes(j)||r.recoveredLessons.push(j);r.pendingErrorLessons=[]}const w=Lo(t.map(j=>({path:j.path,code:j.code}))),_=w.length>0?`

⚠ Unimported stylesheet(s): ${w.join(", ")}. These files exist but no module imports them, so NONE of their styles are applied — the app is rendering with browser defaults. Add an import (e.g. \`import './styles/theme.css'\` in src/App.tsx) and recompile.`:"",A=Mo(t.map(j=>({path:j.path,code:j.code}))),k=A.length>0?`

⚠ Possibly-copyrighted image(s) from non-free hosts:
`+A.slice(0,8).map(j=>`  - ${j.url} (in ${j.path})`).join(`
`)+`
Use only free-to-use images: Unsplash (images.unsplash.com), Picsum (picsum.photos), or placehold.co. Replace these URLs.`:"";return b||_||k?{content:`Compilation + runtime check passed (with warnings).

${b??""}${_}${k}`,isError:!1}:{content:"Compilation + runtime check passed. The app builds and renders with no errors.",isError:!1}}const m=[...new Set(a.errors)];r&&(r.lastCompileOk=!1,mo(r,m.join(" | ")));const f=m.slice(0,ln),u=m.length>ln?`
  ... and ${m.length-ln} more error(s). Fix the first ones first.`:"";return{content:`Compilation failed: ${m.length} error(s).
${f.map((v,b)=>`  ${b+1}. ${v}`).join(`
`)}${u}

Read the affected files and fix each error with edit_file. Recompile after fixing.`,isError:!0}}catch(a){return r&&(r.lastCompileOk=!1),{content:Y({code:"COMPILE_CRASH",message:a instanceof Error?a.message:String(a),suggestion:"This might be a config issue or syntax error. Check recent changes."}),isError:!0}}}case"set_title":{const a=typeof e.input.title=="string"?e.input.title.trim():"";return r&&r.mode==="refine"?{content:JSON.stringify({ok:!1,skipped:"set_title is only for new projects; the existing title was kept."}),isError:!1}:(a&&(i==null||i({type:"title",text:a})),{content:JSON.stringify({ok:!0,title:a}),isError:!1})}case"done":{if(r&&r.doneRejections<3){const f=await wa(r,t);if(f)return r.doneRejections++,{content:f,isError:!0}}const a=String(e.input.summary??"Project complete."),m=(r==null?void 0:r.mode)==="refine"?"":typeof e.input.title=="string"?e.input.title.trim():"";return{content:JSON.stringify({summary:a,title:m}),isError:!1,files:t}}case"load_skill":{const a=String(e.input.skill_id??""),m=Qn.find(f=>f.id===a);return m?{content:m.body,isError:!1}:{content:Y({code:"SKILL_NOT_FOUND",message:`Unknown skill: "${a}"`,suggestion:`Available skills: ${Qn.map(f=>f.id).join(", ")}`}),isError:!0}}default:return{content:Y({code:"UNKNOWN_TOOL",message:`Unknown tool: ${e.name}`,suggestion:`Available tools: ${$t.map(a=>a.name).join(", ")}`}),isError:!0}}}async function wa(e,t,o,n,i){var h;if(e.dirtySinceCompile||!e.lastCompileOk)return Y({code:"DONE_REJECTED",message:e.lastCompileOk?"Files changed since the last passing compile — the current code is unverified.":"No compile has passed (build + runtime) in this run yet.",suggestion:"Run compile now. When it passes for the current files, call done again."});const r=Lo(t.map(a=>({path:a.path,code:a.code})));if(r.length>0)return Y({code:"DONE_REJECTED",message:`Stylesheet(s) exist but nothing imports them: ${r.join(", ")}. None of their styles are applied — the app is rendering with browser defaults.`,suggestion:"Import each stylesheet where it is used (e.g. `import './styles/theme.css'` in src/App.tsx), compile, then call done again."});const l=Mo(t.map(a=>({path:a.path,code:a.code})));if(l.length>0)return Y({code:"DONE_REJECTED",message:`These images load from hosts that are not known to be free to use and may be copyrighted:
`+l.slice(0,8).map(a=>`  - ${a.url} (in ${a.path})`).join(`
`),suggestion:"Replace them with free-to-use images: Unsplash (images.unsplash.com), Picsum (picsum.photos), or placehold.co — or use inline SVG / a gradient. Then compile and call done again."});try{let a=e.lastPreviewHtml;if(!a){const f=await ht(t.map(u=>({path:u.path,content:u.code})),void 0,(h=e.backend)!=null&&h.config?{backend:e.backend.config}:void 0);if(f.errors.length>0)return null;a=f.html}const m=await jr(a);if(m.ran&&!m.ok){const f=$o(m);return Y({code:"DONE_REJECTED",message:`The app breaks when its UI is actually used.
${f??""}`,suggestion:"Fix the failing handler(s), compile, then call done again.",retryable:!0})}}catch{}return null}function _a(e){let t=null,o="",n=!1;return(i,r)=>{if(i!==t&&(t=i,o="",n=!1,e==null||e({type:"generating",toolName:i})),n||o.length>4096)return;o+=r;const l=o.match(/"path"\s*:\s*"((?:[^"\\]|\\.)*)"/);l&&(n=!0,e==null||e({type:"generating",toolName:i,toolInput:{path:l[1]}}))}}async function ka({providerId:e,baseUrl:t,apiKey:o,modelId:n,system:i,tools:r,messages:l,signal:h,onText:a,onToolStream:m,thinkingBudget:f}){const u=Ms[e];if((u==null?void 0:u.apiFormat)==="bedrock")throw new Error("Amazon Bedrock requires a server-side Bedrock Converse adapter and is not available through the browser agent yet.");return(u==null?void 0:u.apiFormat)==="anthropic"||e==="anthropic"?Na({baseUrl:t,apiKey:o,modelId:n,system:i,tools:r,messages:l,signal:h,onText:a,onToolStream:m,thinkingBudget:f}):(u==null?void 0:u.apiFormat)==="gemini"||e==="google"?La({baseUrl:t,apiKey:o,modelId:n,system:i,tools:r,messages:l,signal:h,onText:a,onToolStream:m,thinkingBudget:f}):Sa({providerId:e,baseUrl:t,apiKey:o,modelId:n,system:i,tools:r,messages:l,signal:h,onText:a,onToolStream:m,thinkingBudget:f})}function xa(e){return e.map(t=>({type:"function",function:{name:t.name,description:t.description,parameters:t.input_schema}}))}function ja(e){return e.map(t=>({name:t.name,description:t.description,input_schema:t.input_schema}))}async function Sa({providerId:e,baseUrl:t,apiKey:o,modelId:n,system:i,tools:r,messages:l,signal:h,onText:a,onToolStream:m,thinkingBudget:f}){const u=t.endsWith("/chat/completions")?t:`${t}/chat/completions`,v={"Content-Type":"application/json"};e==="azure"?v["api-key"]=o:v.Authorization=`Bearer ${o}`,e==="openrouter"&&(v["HTTP-Referer"]=window.location.origin,v["X-OpenRouter-Title"]="OpenThorn");const b=[{role:"system",content:i},...l.flatMap(Pa)],w=xa(r),_=Ro(e??"openai",n,f??0),A={include_usage:!0},k=r.length===0?[{stream:!0,stream_options:A,..._},{stream:!1,..._}]:[{tools:w,stream:!0,stream_options:A,..._},{tools:w,stream:!0,stream_options:A,tool_choice:"auto",..._},{tools:w,stream:!1,..._},{stream:!0}];let j="";e:for(let I=0;I<k.length;I++){const S=k[I];for(let N=0;N<mt;N++){ft(h);try{const L=new AbortController,H=setTimeout(()=>L.abort(),6e4),$=h?_n(h,L.signal):L.signal,P=await fetch(u,{method:"POST",redirect:"manual",headers:v,body:JSON.stringify({model:n,messages:b,temperature:.22,max_tokens:Ot,...S}),signal:$});if(clearTimeout(H),!P.ok){const C=await P.text().catch(()=>"");let D="";try{D=JSON.parse(C)}catch{D=C}const te=Ca(D),ne=typeof D=="string"?D:JSON.stringify(D);if(j=`${P.status}: ${(te||ne).slice(0,300)}`,P.status===401||P.status===403)break e;if(bn(P.status)){await Ye(vn(P.headers.get("retry-after"))??Je(N));continue}if(P.status===400||P.status===422)continue e;break e}const R=S.stream===!0?await Ta(P,a,m):await Ea(P,a);if(R)return R;continue e}catch(L){if(L instanceof DOMException&&L.name==="AbortError"){if(h!=null&&h.aborted)throw L;j="Request timed out after 60s."}else j=L instanceof Error?L.message:String(L);await Ye(Je(N))}}}throw new Error(j||"Provider request failed.")}function Ca(e){if(!e||typeof e!="object")return"";const t=e,o=t.error;if(typeof o=="string")return o;if(o&&typeof o=="object"){const i=o.message;if(typeof i=="string")return i}const n=t.message;return typeof n=="string"?n:""}function _n(e,t){const o=new AbortController,n=()=>o.abort();return e.addEventListener("abort",n,{once:!0}),t.addEventListener("abort",n,{once:!0}),(e.aborted||t.aborted)&&o.abort(),o.signal}async function Ea(e,t){var m;const o=await e.json().catch(()=>null);if(!o)return null;const n=(m=o==null?void 0:o.choices)==null?void 0:m[0],i=n==null?void 0:n.message;if(!i)return null;const r=typeof i.content=="string"?i.content:"";r&&t(r);const l=typeof i.reasoning_content=="string"?i.reasoning_content:void 0,h=[],a=[];if(Array.isArray(i.tool_calls)){for(const f of i.tool_calls)if(f.type==="function"&&f.function)try{h.push({id:f.id||`call_${h.length}`,name:f.function.name,input:typeof f.function.arguments=="string"?JSON.parse(f.function.arguments):f.function.arguments??{}})}catch{a.push({id:f.id||`call_${h.length+a.length}`,name:f.function.name??"unknown",raw:typeof f.function.arguments=="string"?f.function.arguments:""})}}return{text:r,toolCalls:h,invalidCalls:a,usage:qo(o==null?void 0:o.usage),reasoningContent:l}}function qo(e){if(!e||typeof e!="object")return;const t=e,o=t.prompt_tokens_details??{};return{inputTokens:Number(t.prompt_tokens)||0,outputTokens:Number(t.completion_tokens)||0,cacheReadTokens:Number(o.cached_tokens)||0,cacheWriteTokens:0}}async function Ta(e,t,o){var v,b,w,_,A,k,j;const n=(v=e.body)==null?void 0:v.getReader();if(!n)return null;const i=new TextDecoder;let r="",l="",h="",a;const m=new Map;try{for(;;){const{done:I,value:S}=await n.read();if(I)break;r+=i.decode(S,{stream:!0});const N=r.split(`
`);r=N.pop()||"";for(const L of N){const H=L.trim();if(!H||!H.startsWith("data:"))continue;const $=H.slice(5).trim();if($!=="[DONE]")try{const P=JSON.parse($);P!=null&&P.usage&&(a=qo(P.usage)??a);const R=(w=(b=P==null?void 0:P.choices)==null?void 0:b[0])==null?void 0:w.delta;if(R!=null&&R.reasoning_content&&(h+=R.reasoning_content),R!=null&&R.content&&(l+=R.content,t(R.content)),R!=null&&R.tool_calls)for(const C of R.tool_calls){const D=C.index??0;m.has(D)||m.set(D,{id:C.id??`call_${D}`,name:((_=C.function)==null?void 0:_.name)??"",arguments:""});const te=m.get(D);C.id&&(te.id=C.id),(A=C.function)!=null&&A.name&&(te.name=C.function.name),(k=C.function)!=null&&k.arguments&&(te.arguments+=C.function.arguments),te.name&&(o==null||o(te.name,((j=C.function)==null?void 0:j.arguments)??""))}}catch{}}}}finally{n.releaseLock()}const f=[],u=[];for(const I of m.values())if(I.name)try{f.push({id:I.id,name:I.name,input:JSON.parse(I.arguments||"{}")})}catch{u.push({id:I.id,name:I.name,raw:I.arguments})}return{text:l,toolCalls:f,invalidCalls:u,usage:a,reasoningContent:h||void 0}}async function Na({baseUrl:e,apiKey:t,modelId:o,system:n,tools:i,messages:r,signal:l,onText:h,onToolStream:a,thinkingBudget:m}){const f=r.map($a),u=f[f.length-1];if(u){if(typeof u.content=="string"&&u.content.length>0)u.content=[{type:"text",text:u.content,cache_control:{type:"ephemeral"}}];else if(Array.isArray(u.content)&&u.content.length>0){const w=u.content,_=w[w.length-1],A=_==null?void 0:_.type;(A==="text"||A==="tool_result"||A==="image"||A==="tool_use")&&(w[w.length-1]={..._,cache_control:{type:"ephemeral"}})}}const v={model:o,max_tokens:Ot,messages:f,stream:!0,system:[{type:"text",text:n,cache_control:{type:"ephemeral"}}]};i.length>0&&(v.tools=ja(i));const b=m??Yr;b>0&&i.length>0&&Xr(o)&&(v.thinking={type:"enabled",budget_tokens:b},v.temperature=1,v.max_tokens=b+Ot);for(let w=0;;w++){ft(l);const _=new AbortController,A=setTimeout(()=>_.abort(),12e4),k=l?_n(l,_.signal):_.signal;let j;try{j=await fetch(`${e}/messages`,{method:"POST",redirect:"manual",headers:{"Content-Type":"application/json","x-api-key":t,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify(v),signal:k})}catch(I){if(clearTimeout(A),l!=null&&l.aborted||w>=mt-1)throw I;await Ye(Je(w));continue}if(clearTimeout(A),!j.ok){const I=await j.text().catch(()=>"");let S="";try{S=JSON.parse(I)}catch{S=I}const N=`Anthropic ${j.status}: ${typeof S=="string"?S.slice(0,400):JSON.stringify(S).slice(0,400)}`;if(bn(j.status)&&w<mt-1){await Ye(vn(j.headers.get("retry-after"))??Je(w));continue}throw new Error(N)}return Ia(j,h,a)}}async function Ia(e,t,o){var b,w,_,A,k,j,I,S,N;const n=(b=e.body)==null?void 0:b.getReader();if(!n)throw new Error("Response body not readable");const i=new TextDecoder;let r="",l="";const h=wn(),a=new Map,m=new Map;try{for(;;){const{done:L,value:H}=await n.read();if(L)break;r+=i.decode(H,{stream:!0});const $=r.split(`
`);r=$.pop()||"";for(const P of $){const R=P.trim();if(!(!R||!R.startsWith("data:")))try{const C=JSON.parse(R.slice(5).trim());if(C.type==="content_block_delta"&&((w=C.delta)==null?void 0:w.type)==="text_delta"&&(l+=C.delta.text,t(C.delta.text)),C.type==="message_start"&&((_=C.message)!=null&&_.usage)){const D=C.message.usage;h.inputTokens=D.input_tokens??0,h.cacheReadTokens=D.cache_read_input_tokens??0,h.cacheWriteTokens=D.cache_creation_input_tokens??0}if(C.type==="message_delta"&&((A=C.usage)==null?void 0:A.output_tokens)!=null&&(h.outputTokens=C.usage.output_tokens),C.type==="content_block_start"&&((k=C.content_block)==null?void 0:k.type)==="thinking"&&m.set(C.index,{thinking:C.content_block.thinking??"",signature:C.content_block.signature??""}),C.type==="content_block_delta"&&((j=C.delta)==null?void 0:j.type)==="thinking_delta"){const D=m.get(C.index);D&&(D.thinking+=C.delta.thinking??"")}if(C.type==="content_block_delta"&&((I=C.delta)==null?void 0:I.type)==="signature_delta"){const D=m.get(C.index);D&&(D.signature+=C.delta.signature??"")}if(C.type==="content_block_start"&&((S=C.content_block)==null?void 0:S.type)==="tool_use"&&(a.set(C.index,{id:C.content_block.id,name:C.content_block.name,input:""}),o==null||o(C.content_block.name,"")),C.type==="content_block_delta"&&((N=C.delta)==null?void 0:N.type)==="input_json_delta"){const D=a.get(C.index);D&&(D.input+=C.delta.partial_json,o==null||o(D.name,C.delta.partial_json??""))}}catch{}}}}finally{n.releaseLock()}const f=[],u=[];for(const L of a.values())try{f.push({id:L.id,name:L.name,input:L.input?JSON.parse(L.input):{}})}catch{u.push({id:L.id,name:L.name,raw:L.input})}const v=[...m.values()].filter(L=>L.signature);return{text:l,toolCalls:f,thinkingBlocks:v,invalidCalls:u,usage:h}}const Aa="skip_thought_signature_validator";function Ra(e){return e.map(t=>{const o=t.role==="assistant"?"model":"user";if(typeof t.content=="string")return{role:o,parts:[{text:t.content}]};const n=[];for(const i of t.content)if(i.type==="text"&&i.text)n.push({text:i.text});else if(i.type==="image"&&i.image)n.push({inlineData:{mimeType:i.image.mediaType,data:i.image.base64}});else if(i.type==="tool_use")n.push({functionCall:{name:i.name,args:i.input??{}},thoughtSignature:i.thoughtSignature??Aa});else if(i.type==="tool_result"){const r=Oa(e,i.tool_use_id);n.push({functionResponse:{name:(r==null?void 0:r.name)??"unknown",response:{content:i.content,is_error:i.is_error}}})}return{role:o,parts:n.length>0?n:[{text:""}]}})}async function La({baseUrl:e,apiKey:t,modelId:o,system:n,tools:i,messages:r,signal:l,onText:h,onToolStream:a,thinkingBudget:m}){const f=o.replace(/^models\//,""),u=`${e}/models/${encodeURIComponent(f)}:streamGenerateContent?alt=sse`,v=i.map(A=>({name:A.name,description:A.description,parameters:gn(A.input_schema)})),b=n?[{text:n}]:[],w=Ra(r),_=JSON.stringify({systemInstruction:b.length>0?{parts:b}:void 0,contents:w,tools:v.length>0?[{functionDeclarations:v}]:void 0,generationConfig:{temperature:.22,maxOutputTokens:Ot,...Ro("google",o,m??0)}});for(let A=0;;A++){ft(l);const k=new AbortController,j=setTimeout(()=>k.abort(),6e4),I=l?_n(l,k.signal):k.signal;let S;try{S=await fetch(u,{method:"POST",redirect:"manual",headers:{"Content-Type":"application/json","x-goog-api-key":t},body:_,signal:I})}catch(N){if(clearTimeout(j),l!=null&&l.aborted||A>=mt-1)throw N;await Ye(Je(A));continue}if(clearTimeout(j),!S.ok){const N=await S.text().catch(()=>"");if(bn(S.status)&&A<mt-1){await Ye(vn(S.headers.get("retry-after"))??Je(A));continue}throw new Error(`Gemini ${S.status}: ${N.slice(0,400)}`)}return Ma(S,h,a)}}async function Ma(e,t,o){var u,v,b,w,_;const n=(u=e.body)==null?void 0:u.getReader();if(!n)throw new Error("Response body not readable");const i=new TextDecoder;let r="",l="";const h=wn(),a=[];let m=0;try{for(;;){const{done:A,value:k}=await n.read();if(A)break;r+=i.decode(k,{stream:!0});const j=r.split(`
`);r=j.pop()||"";for(const I of j){const S=I.trim();if(!(!S||!S.startsWith("data:")))try{const N=JSON.parse(S.slice(5).trim());N!=null&&N.usageMetadata&&(h.inputTokens=N.usageMetadata.promptTokenCount??h.inputTokens,h.outputTokens=N.usageMetadata.candidatesTokenCount??h.outputTokens,h.cacheReadTokens=N.usageMetadata.cachedContentTokenCount??h.cacheReadTokens);const L=(w=(b=(v=N==null?void 0:N.candidates)==null?void 0:v[0])==null?void 0:b.content)==null?void 0:w.parts;if(L){let H=0;for(const $ of L)if($.text&&(l+=$.text,t($.text)),$.functionCall){const P=$.thoughtSignature??$.functionCall.thoughtSignature;if(H<a.length){const R=a[H];R.input=$.functionCall.args??R.input,P&&(R.thoughtSignature=P),o==null||o(R.name,JSON.stringify(R.input??{}))}else m++,a.push({id:`call_${m}`,name:$.functionCall.name,input:$.functionCall.args??{},thoughtSignature:P}),o==null||o($.functionCall.name,JSON.stringify($.functionCall.args??{}));H++}}}catch{}}}}finally{n.releaseLock()}const f=(_=a.find(A=>A.thoughtSignature))==null?void 0:_.thoughtSignature;if(f)for(const A of a)A.thoughtSignature||(A.thoughtSignature=f);return{text:l,toolCalls:a,usage:h}}function Pa(e){if(typeof e.content=="string")return[{role:e.role,content:e.content}];const t=e.content.filter(i=>i.type==="tool_result");if(t.length>0&&e.role==="user")return t.map(i=>({role:"tool",tool_call_id:i.tool_use_id,content:i.content??""}));const o=[],n=[];for(const i of e.content)i.type==="text"&&i.text?o.push({type:"text",text:i.text}):i.type==="image"&&i.image?o.push({type:"image_url",image_url:{url:`data:${i.image.mediaType};base64,${i.image.base64}`}}):i.type==="tool_use"&&n.push({id:i.id,type:"function",function:{name:i.name,arguments:JSON.stringify(i.input??{})}});if(n.length>0&&e.role==="assistant"){const i={role:"assistant",content:o.length>0?o:null,tool_calls:n};return e.reasoningContent&&(i.reasoning_content=e.reasoningContent),[i]}if(o.length>0){const i={role:e.role,content:o};return e.role==="assistant"&&e.reasoningContent&&(i.reasoning_content=e.reasoningContent),[i]}return[{role:e.role,content:e.content.map(i=>i.content??i.text??"").join(`
`)}]}function $a(e){if(typeof e.content=="string")return{role:e.role,content:e.content};const t=[];for(const o of e.content)o.type==="thinking"&&o.signature&&t.push({type:"thinking",thinking:o.thinking??"",signature:o.signature});for(const o of e.content)o.type!=="thinking"&&(o.type==="text"&&o.text?t.push({type:"text",text:o.text}):o.type==="image"&&o.image?t.push({type:"image",source:{type:"base64",media_type:o.image.mediaType,data:o.image.base64}}):o.type==="tool_use"?t.push({type:"tool_use",id:o.id,name:o.name,input:o.input??{}}):o.type==="tool_result"&&t.push({type:"tool_result",tool_use_id:o.tool_use_id,content:o.content,is_error:o.is_error}));return{role:e.role,content:t}}function Oa(e,t){if(!t)return null;for(const o of e)if(o.role==="assistant"&&Array.isArray(o.content)){for(const n of o.content)if(n.type==="tool_use"&&n.id===t)return n}return null}function Da(e,t,o,n,i,r=!1){const l=o.filter(a=>a.path!=="No files yet").map(a=>`- ${a.path}`).join(`
`),h=aa(e)?`

The user is asking you to continue the unfinished work. Take the next concrete tool action toward completing the remaining features.`:"";if(i||n==="create"){let a=`The user's message: ${e}

Project title: ${t}

If this is a request to build something, create a web app for it: think about the design and file plan first, then create files in order: theme.css → App.tsx → pages → components. Write complete files and compile after every few to catch build AND runtime errors early.

If it is NOT a build request (a greeting, casual remark, or question), do not build anything — reply in plain text with no tool calls.`;return l&&(a+=`

NOTE: the workspace still contains files from a previous, unrelated project:
${l}
These do not belong to what the user asked for. Overwrite the ones you reuse (App.tsx, theme.css) and delete_file the rest so the project only contains files for THIS app.`),a+h}return r?`The user's message about the existing project: ${e}

Project title: ${t}

Current files:
${l||"(none)"}

This is a small, self-contained change. Work in as FEW turns as possible — a competent engineer does this in one edit:
- Go straight to the edit. Read at most the ONE file you're changing (skip even that if its contents are already shown in the conversation above), then make the focused edit with edit_file/multi_edit.
- Compile ONCE (build + runtime) to verify, then call done. No extra reads, no re-compiles, no unrequested polish.

If this is a question or remark rather than a change request, answer it in plain text and do not modify any files or call done.`:`The user's message about the existing project: ${e}

Project title: ${t}

Current files:
${l||"(none)"}${h}

If this requests a change, update the project: read files before editing them, use search_files to find patterns, multi_edit for several changes to one file, and delete_file to remove anything this change makes obsolete. Make focused changes and compile (build + runtime) after edits to verify.

If it is a question or remark rather than a change request, answer it in plain text (use read-only tools to look things up if needed) and do not modify any files or call done.`}function go(e){return Ps(e)}function Ba(e){const t=e.replace(/\/+$/,"");let o;try{o=new URL(t).hostname.toLowerCase()}catch{throw new Error(`Invalid base URL: ${t.slice(0,100)}`)}if(!(ro.has(o)||o.endsWith(".openai.azure.com")||o.endsWith(".services.ai.azure.com")||/^bedrock-runtime\.[a-z0-9-]+\.amazonaws\.com$/.test(o)))throw new Error(`Provider URL host "${o}" is not in the allowed list. Use one of: ${[...ro].sort().join(", ")}`);return t}function Fa(e,t){const o=new Set,n=[];for(const i of[...e,...t])o.has(i.id)||(o.add(i.id),n.push(i));return n}function Ua(e,t){const n=(e!==null&&typeof e=="object"?e:{})[t];return typeof n=="string"?n:""}async function yo(e,t,o){var m,f;const{data:n,error:i}=await F.from("provider_keys").select("id, provider_id, provider_name, api_key, base_url, models, enabled, is_custom").eq("user_id",e).eq("enabled",!0).order("created_at",{ascending:!0});if(i)throw new Error(`Could not load providers: ${i.message}`);if(!n||n.length===0)throw new Error("No enabled provider found. Add a provider key to get started.");const r=await Promise.all(n.map(async u=>({...u,api_key:await Ks(u.api_key,e)})));for(const u of n)if(u.api_key.startsWith("enc:")){const v=(m=r.find(b=>b.id===u.id))==null?void 0:m.api_key;v&&Js(v,e).then(async b=>{b.startsWith("senc:")&&await F.from("provider_keys").update({api_key:b}).eq("id",u.id).eq("user_id",e)}).catch(()=>{})}const l=[...r];if(t){const u=l.findIndex(v=>v.provider_id===t.provider_id);if(u>0){const[v]=l.splice(u,1);l.unshift(v)}}const h=l.filter(u=>!Be.isOpen(u.provider_id)&&!(o!=null&&o.has(u.provider_id)));if(h.length===0)throw new Error("All providers are temporarily unavailable (circuit breaker open). Please wait a moment and try again.");const a=[];for(let u=0;u<h.length;u++){const v=h[u];try{const{data:b}=await F.from("default_models").select("provider_id, models").eq("provider_id",v.provider_id).maybeSingle(),w=go(Ua(b,"models")),_=w.length>0?w:Rs[v.provider_id]??[],A=go(v.models),k=Fa(_,A),j=t&&t.provider_id===v.provider_id?k.find(N=>N.id===t.model_id)??{name:t.model_name,id:t.model_id}:k[0];if(!(j!=null&&j.id)){a.push(`${v.provider_name||v.provider_id}: No model configured`);continue}const I=(((f=v.base_url)==null?void 0:f.trim())||Ls[v.provider_id]||"").replace(/\/+$/,"");if(!I){a.push(`${v.provider_name||v.provider_id}: No base URL configured`);continue}const S=Ba(I);return{key:v,baseUrl:S,model:j,models:k}}catch(b){const w=b instanceof Error?b.message:String(b);if(a.push(`${v.provider_name||v.provider_id}: ${w}`),Be.recordFailure(v.provider_id),u<h.length-1)continue}}throw new Error(`Could not connect to any provider:
${a.map(u=>`  - ${u}`).join(`
`)}`)}function Wa(e){return e.trim().split(/\s+/).filter(Boolean).map(t=>t[0]??"").join("").toUpperCase().slice(0,2)}function Ha({projectId:e,userId:t,userName:o,userEmail:n,onFilesUpdate:i,onChatUpdate:r,onGeneratingChange:l}){const[h,a]=y.useState([]),m=y.useRef(i),f=y.useRef(r),u=y.useRef(l);return y.useEffect(()=>{m.current=i},[i]),y.useEffect(()=>{f.current=r},[r]),y.useEffect(()=>{u.current=l},[l]),y.useEffect(()=>{if(!e||!t)return;const v=Wa(o),b=F.channel(`project:${e}`,{config:{presence:{key:t}}});return b.on("presence",{event:"sync"},()=>{const w=b.presenceState(),_=new Set,A=Object.values(w).flat().filter(k=>k.userId!==t).filter(k=>_.has(k.userId)?!1:(_.add(k.userId),!0));a(A)}).on("postgres_changes",{event:"UPDATE",schema:"public",table:"projects",filter:`id=eq.${e}`},w=>{const _=w.new;Array.isArray(_.files)&&m.current(_.files),Array.isArray(_.chat_history)&&f.current(_.chat_history),typeof _.generating=="boolean"&&u.current(_.generating,_.generating_by??null)}).subscribe(async w=>{w==="SUBSCRIBED"&&await b.track({userId:t,name:o,initials:v,email:n})}),()=>{F.removeChannel(b)}},[e,t,o,n]),{onlineCollaborators:h}}const qa="_root_1nnn9_1",Ga="_topbar_1nnn9_11",za="_topbarCenter_1nnn9_23",Va="_topbarLeft_1nnn9_28",Ka="_topActions_1nnn9_29",Ja="_brandCluster_1nnn9_30",Ya="_navAction_1nnn9_31",Xa="_modeSwitch_1nnn9_32",Za="_previewTools_1nnn9_33",Qa="_assistantTop_1nnn9_34",el="_previewChrome_1nnn9_35",tl="_previewChromeDots_1nnn9_36",nl="_previewChecklist_1nnn9_37",ol="_editorHeader_1nnn9_38",sl="_backBtn_1nnn9_48",il="_iconBtn_1nnn9_49",rl="_githubLogo_1nnn9_84",al="_iconBtnActive_1nnn9_96",ll="_shareBtn_1nnn9_119",cl="_deployBtn_1nnn9_120",dl="_logo_1nnn9_129",ul="_projectNameBtn_1nnn9_136",pl="_projectNameInput_1nnn9_159",hl="_projectMeta_1nnn9_175",ml="_modelBadge_1nnn9_185",fl="_modeActive_1nnn9_226",gl="_divider_1nnn9_238",yl="_deployBtnDeployed_1nnn9_302",bl="_deployModal_1nnn9_312",vl="_deployBody_1nnn9_325",wl="_deployBodyInner_1nnn9_334",_l="_deployStatus_1nnn9_340",kl="_deploySuccessIcon_1nnn9_349",xl="_deployUrl_1nnn9_360",jl="_deployError_1nnn9_371",Sl="_githubInstructions_1nnn9_376",Cl="_spinner_1nnn9_386",El="_spinnerLarge_1nnn9_387",Tl="_spin_1nnn9_386",Nl="_spinnerSmall_1nnn9_403",Il="_shareOverlay_1nnn9_417",Al="_shareDialog_1nnn9_429",Rl="_shareHeader_1nnn9_444",Ll="_shareEyebrow_1nnn9_455",Ml="_closeBtn_1nnn9_475",Pl="_removeBtn_1nnn9_476",$l="_inviteBtn_1nnn9_503",Ol="_copyBtn_1nnn9_504",Dl="_permissionToggle_1nnn9_505",Bl="_inviteForm_1nnn9_509",Fl="_readOnlyShare_1nnn9_515",Ul="_inviteLabel_1nnn9_527",Wl="_inviteRow_1nnn9_535",Hl="_emailInputWrap_1nnn9_542",ql="_permissionActive_1nnn9_602",Gl="_inviteFeedback_1nnn9_632",zl="_inviteError_1nnn9_641",Vl="_inviteSuccess_1nnn9_645",Kl="_linkPanel_1nnn9_649",Jl="_linkIcon_1nnn9_662",Yl="_linkText_1nnn9_673",Xl="_peoplePanel_1nnn9_705",Zl="_peopleHeader_1nnn9_713",Ql="_personList_1nnn9_735",ec="_personItem_1nnn9_743",tc="_personAvatar_1nnn9_755",nc="_personInfo_1nnn9_775",oc="_ownerBadge_1nnn9_801",sc="_permissionSelect_1nnn9_815",ic="_emptyInvites_1nnn9_844",rc="_shell_1nnn9_855",ac="_chatPanel_1nnn9_862",lc="_thread_1nnn9_870",cc="_userMessage_1nnn9_881",dc="_avatar_1nnn9_887",uc="_userBubble_1nnn9_911",pc="_assistantMessage_1nnn9_927",hc="_assistantMessageError_1nnn9_931",mc="_markdown_1nnn9_956",fc="_tableWrapper_1nnn9_1135",gc="_fileList_1nnn9_1142",yc="_thinkingBlock_1nnn9_1167",bc="_thinkingBlockCollapsed_1nnn9_1176",vc="_thinkingToggle_1nnn9_1181",wc="_thinkingIcon_1nnn9_1202",_c="_thinkingLabel_1nnn9_1209",kc="_thinkingDot_1nnn9_1214",xc="_thinkingPulse_1nnn9_1",jc="_thinkingContent_1nnn9_1228",Sc="_thinkingThought_1nnn9_1235",Cc="_thinkingPlan_1nnn9_1249",Ec="_thinkingPlanLabel_1nnn9_1254",Tc="_thinkingPlanList_1nnn9_1263",Nc="_streamingFiles_1nnn9_1283",Ic="_streamingFilesLabel_1nnn9_1291",Ac="_streamingPulse_1nnn9_1301",Rc="_streamingPulseAnim_1nnn9_1",Lc="_generatingIndicator_1nnn9_1314",Mc="_generatingDot_1nnn9_1320",Pc="_generatingBlink_1nnn9_1",$c="_miniSpinner_1nnn9_1333",Oc="_miniSpin_1nnn9_1333",Dc="_streamingFileItems_1nnn9_1347",Bc="_streamingFileItem_1nnn9_1347",Fc="_streamingFileItemDone_1nnn9_1363",Uc="_streamingFileIcon_1nnn9_1367",Wc="_streamingFileName_1nnn9_1378",Hc="_streamingFileSize_1nnn9_1393",qc="_timeline_1nnn9_1402",Gc="_timelineText_1nnn9_1408",zc="_timelineStatus_1nnn9_1414",Vc="_timelineStatusSuccess_1nnn9_1425",Kc="_toolCall_1nnn9_1433",Jc="_toolCallRunning_1nnn9_1446",Yc="_toolCallError_1nnn9_1451",Xc="_toolCallIcon_1nnn9_1456",Zc="_toolCallX_1nnn9_1471",Qc="_toolCallLabel_1nnn9_1477",ed="_toolCallDetail_1nnn9_1483",td="_errorCard_1nnn9_1499",nd="_errorCardHeader_1nnn9_1507",od="_errorCardIcon_1nnn9_1513",sd="_errorCardTitle_1nnn9_1528",id="_errorCardDetail_1nnn9_1534",rd="_errorCardTip_1nnn9_1543",ad="_errorCardTipLabel_1nnn9_1555",ld="_completionSummary_1nnn9_1570",cd="_completionBadge_1nnn9_1577",dd="_composer_1nnn9_1588",ud="_viewOnlyNotice_1nnn9_1594",pd="_previewPane_1nnn9_1608",hd="_previewPaneFullscreen_1nnn9_1618",md="_previewToolbar_1nnn9_1625",fd="_deviceSwitch_1nnn9_1647",gd="_deviceBtn_1nnn9_1657",yd="_deviceBtnActive_1nnn9_1658",bd="_previewRebuild_1nnn9_1682",vd="_rebuildOverlay_1nnn9_1690",wd="_rebuildSlide_1nnn9_1",_d="_previewCenter_1nnn9_1716",kd="_addressBar_1nnn9_1730",xd="_previewStage_1nnn9_1762",jd="_editToggleActive_1nnn9_1774",Sd="_editModeBadge_1nnn9_1788",Cd="_pageFade_1nnn9_1",Ed="_previewCardEditing_1nnn9_1824",Td="_deviceFrame_1nnn9_1829",Nd="_desktop_1nnn9_1837",Id="_tablet_1nnn9_1841",Ad="_phone_1nnn9_1846",Rd="_previewCard_1nnn9_1824",Ld="_previewState_1nnn9_1865",Md="_previewEmpty_1nnn9_1869",Pd="_previewSkeleton_1nnn9_1886",$d="_skeletonWide_1nnn9_1890",Od="_previewPath_1nnn9_1926",Dd="_previewBlank_1nnn9_1955",Bd="_previewMark_1nnn9_1967",Fd="_previewFrame_1nnn9_2046",Ud="_errorList_1nnn9_2054",Wd="_errorLine_1nnn9_2064",Hd="_codeWorkspace_1nnn9_2079",qd="_codeSidebar_1nnn9_2089",Gd="_codeSidebarTitle_1nnn9_2097",zd="_fileTree_1nnn9_2107",Vd="_treeNode_1nnn9_2112",Kd="_treeFileActive_1nnn9_2138",Jd="_treeGuides_1nnn9_2148",Yd="_treeGuide_1nnn9_2148",Xd="_treeChevron_1nnn9_2165",Zd="_treeIcon_1nnn9_2175",Qd="_treeName_1nnn9_2188",eu="_editorPane_1nnn9_2211",tu="_editorTabs_1nnn9_2219",nu="_editorTab_1nnn9_2219",ou="_tabIcon_1nnn9_2243",su="_tabClose_1nnn9_2248",iu="_editorBody_1nnn9_2268",ru="_editorGutter_1nnn9_2275",au="_codeBlock_1nnn9_2295",lu="_editorStatusBar_1nnn9_2310",cu="_presenceAvatars_1nnn9_2541",du="_presenceAvatar_1nnn9_2541",uu="_presencePopover_1nnn9_2576",pu="_presencePopoverAvatar_1nnn9_2593",hu="_presencePopoverName_1nnn9_2606",mu="_presencePopoverEmail_1nnn9_2613",fu="_publishBtn_1nnn9_2621",gu="_publishBackdrop_1nnn9_2648",yu="_publishModal_1nnn9_2659",bu="_publishClose_1nnn9_2672",vu="_publishModalTitle_1nnn9_2689",wu="_publishModalSubtitle_1nnn9_2696",_u="_publishModalLabel_1nnn9_2703",ku="_publishModalOptional_1nnn9_2714",xu="_publishModalTextarea_1nnn9_2721",ju="_publishModalBtn_1nnn9_2739",Su="_publishModalError_1nnn9_2754",Cu="_publishSuccessToast_1nnn9_2763",d={root:qa,topbar:Ga,topbarCenter:za,topbarLeft:Va,topActions:Ka,brandCluster:Ja,navAction:Ya,modeSwitch:Xa,previewTools:Za,assistantTop:Qa,previewChrome:el,previewChromeDots:tl,previewChecklist:nl,editorHeader:ol,backBtn:sl,iconBtn:il,githubLogo:rl,iconBtnActive:al,shareBtn:ll,deployBtn:cl,logo:dl,projectNameBtn:ul,projectNameInput:pl,projectMeta:hl,modelBadge:ml,modeActive:fl,divider:gl,deployBtnDeployed:yl,deployModal:bl,deployBody:vl,deployBodyInner:wl,deployStatus:_l,deploySuccessIcon:kl,deployUrl:xl,deployError:jl,githubInstructions:Sl,spinner:Cl,spinnerLarge:El,spin:Tl,spinnerSmall:Nl,shareOverlay:Il,shareDialog:Al,shareHeader:Rl,shareEyebrow:Ll,closeBtn:Ml,removeBtn:Pl,inviteBtn:$l,copyBtn:Ol,permissionToggle:Dl,inviteForm:Bl,readOnlyShare:Fl,inviteLabel:Ul,inviteRow:Wl,emailInputWrap:Hl,permissionActive:ql,inviteFeedback:Gl,inviteError:zl,inviteSuccess:Vl,linkPanel:Kl,linkIcon:Jl,linkText:Yl,peoplePanel:Xl,peopleHeader:Zl,personList:Ql,personItem:ec,personAvatar:tc,personInfo:nc,ownerBadge:oc,permissionSelect:sc,emptyInvites:ic,shell:rc,chatPanel:ac,thread:lc,userMessage:cc,avatar:dc,userBubble:uc,assistantMessage:pc,assistantMessageError:hc,markdown:mc,tableWrapper:fc,fileList:gc,thinkingBlock:yc,thinkingBlockCollapsed:bc,thinkingToggle:vc,thinkingIcon:wc,thinkingLabel:_c,thinkingDot:kc,thinkingPulse:xc,thinkingContent:jc,thinkingThought:Sc,thinkingPlan:Cc,thinkingPlanLabel:Ec,thinkingPlanList:Tc,streamingFiles:Nc,streamingFilesLabel:Ic,streamingPulse:Ac,streamingPulseAnim:Rc,generatingIndicator:Lc,generatingDot:Mc,generatingBlink:Pc,miniSpinner:$c,miniSpin:Oc,streamingFileItems:Dc,streamingFileItem:Bc,streamingFileItemDone:Fc,streamingFileIcon:Uc,streamingFileName:Wc,streamingFileSize:Hc,timeline:qc,timelineText:Gc,timelineStatus:zc,timelineStatusSuccess:Vc,toolCall:Kc,toolCallRunning:Jc,toolCallError:Yc,toolCallIcon:Xc,toolCallX:Zc,toolCallLabel:Qc,toolCallDetail:ed,errorCard:td,errorCardHeader:nd,errorCardIcon:od,errorCardTitle:sd,errorCardDetail:id,errorCardTip:rd,errorCardTipLabel:ad,completionSummary:ld,completionBadge:cd,composer:dd,viewOnlyNotice:ud,previewPane:pd,previewPaneFullscreen:hd,previewToolbar:md,deviceSwitch:fd,deviceBtn:gd,deviceBtnActive:yd,previewRebuild:bd,rebuildOverlay:vd,rebuildSlide:wd,previewCenter:_d,addressBar:kd,previewStage:xd,editToggleActive:jd,editModeBadge:Sd,pageFade:Cd,previewCardEditing:Ed,deviceFrame:Td,desktop:Nd,tablet:Id,phone:Ad,previewCard:Rd,previewState:Ld,previewEmpty:Md,previewSkeleton:Pd,skeletonWide:$d,previewPath:Od,previewBlank:Dd,previewMark:Bd,previewFrame:Fd,errorList:Ud,errorLine:Wd,codeWorkspace:Hd,codeSidebar:qd,codeSidebarTitle:Gd,fileTree:zd,treeNode:Vd,treeFileActive:Kd,treeGuides:Jd,treeGuide:Yd,treeChevron:Xd,treeIcon:Zd,treeName:Qd,editorPane:eu,editorTabs:tu,editorTab:nu,tabIcon:ou,tabClose:su,editorBody:iu,editorGutter:ru,codeBlock:au,editorStatusBar:lu,presenceAvatars:cu,presenceAvatar:du,presencePopover:uu,presencePopoverAvatar:pu,presencePopoverName:hu,presencePopoverEmail:mu,publishBtn:fu,publishBackdrop:gu,publishModal:yu,publishClose:bu,publishModalTitle:vu,publishModalSubtitle:wu,publishModalLabel:_u,publishModalOptional:ku,publishModalTextarea:xu,publishModalBtn:ju,publishModalError:Su,publishSuccessToast:Cu},Mt={path:"No files yet",language:"txt",code:"OpenThorn will show the generated files after the first successful build."};function Eu(e,t){const o=Co(e);if(t==="css")return o.replace(/(\/\*[\s\S]*?\*\/)/g,'<span class="syn-comment">$1</span>').replace(/(@[a-z-]+)/g,'<span class="syn-keyword">$1</span>').replace(/([.#]?[a-zA-Z_-]+)(?=\s*\{)/g,'<span class="syn-selector">$1</span>').replace(/([a-z-]+)(?=\s*:)/g,'<span class="syn-property">$1</span>').replace(/(:\s*)([^;]+)/g,'$1<span class="syn-value">$2</span>').replace(/(&quot;(?:[^&]|&(?!quot;))*&quot;|&#39;(?:[^&]|&(?!#39;))*&#39;)/g,'<span class="syn-string">$1</span>').replace(/(\b[\d.]+(?:px|em|rem|%|vh|vw|s|ms|deg|fr)?\b)/g,'<span class="syn-number">$1</span>');let n=o;return n=n.replace(/(&quot;(?:[^&]|&(?!quot;))*&quot;|&#39;(?:[^&]|&(?!#39;))*&#39;|`(?:[^`\\]|\\.)*`)/g,'<span class="syn-string">$1</span>'),n=n.replace(/(\/\/.*$)/gm,'<span class="syn-comment">$1</span>'),n=n.replace(/(&lt;\/?)([A-Z][a-zA-Z0-9]*)/g,'$1<span class="syn-tag">$2</span>'),n=n.replace(/(&lt;\/?)([a-z][a-zA-Z0-9]*)/g,'$1<span class="syn-tag-lower">$2</span>'),n=n.replace(/(\s)([a-zA-Z-]+)(=)/g,'$1<span class="syn-attr">$2</span>$3'),n=n.replace(/(\{|\})/g,'<span class="syn-brace">$1</span>'),n=n.replace(/\b(export|default|function|return|const|let|var|import|from|if|else|for|while|class|new|this|async|await|typeof|instanceof|extends|implements|interface|type|enum|switch|case|break|continue|throw|try|catch|finally|void|null|undefined|true|false|as)\b/g,'<span class="syn-keyword">$1</span>'),n=n.replace(/\b(\d+\.?\d*)\b/g,'<span class="syn-number">$1</span>'),n=n.replace(/(=&gt;)/g,'<span class="syn-keyword">$1</span>'),n}function Tu(e){const t=[],o=new Map,n=[...e].sort((i,r)=>{const l=i.path.split("/"),h=r.path.split("/"),a=Math.min(l.length,h.length);for(let m=0;m<a;m++){const f=m===l.length-1,u=m===h.length-1;if(f&&!u)return 1;if(!f&&u)return-1;if(l[m]!==h[m])return l[m].localeCompare(h[m])}return l.length-h.length});for(const i of n){const r=i.path.split("/");let l=t,h="";for(let a=0;a<r.length;a++){const m=r[a],f=a===r.length-1;if(h=h?`${h}/${m}`:m,f)l.push({name:m,path:i.path,type:"file",children:[],language:i.language});else{let u=o.get(h);u||(u={name:m,path:h,type:"folder",children:[]},l.push(u),o.set(h,u)),l=u.children}}}return t}const bo=["#7c3aed","#0d9488","#d97706","#e11d48","#0284c7","#16a34a","#ea580c","#db2777"];function dn(e){let t=0;for(let o=0;o<e.length;o++)t=t*31+e.charCodeAt(o)>>>0;return bo[t%bo.length]}function vo(e){return e.map(t=>({...t}))}function Pt(e,t){switch(e){case"think":return"Thinking";case"list_files":return"Checking project files";case"read_file":return`Reading ${(t==null?void 0:t.path)||"file"}`;case"write_file":return`Writing ${(t==null?void 0:t.path)||"file"}`;case"edit_file":return`Editing ${(t==null?void 0:t.path)||"file"}`;case"multi_edit":return`Editing ${(t==null?void 0:t.path)||"file"}`;case"delete_file":return`Deleting ${(t==null?void 0:t.path)||"file"}`;case"compile":return"Verifying build";case"done":return"Wrapping up";case"set_title":return"Naming project";default:return e.replace(/_/g," ").replace(/^\w/,o=>o.toUpperCase())}}function Nu(e,t){switch(e){case"think":return"";case"write_file":return`${(t==null?void 0:t.language)||"tsx"} - ${wo(String((t==null?void 0:t.code)??"").length)}`;case"edit_file":return`Replacing ${wo(String((t==null?void 0:t.old_string)??"").length)}`;case"multi_edit":return`${Array.isArray(t==null?void 0:t.edits)?t.edits.length:0} edits`;case"delete_file":return"Removing unused file";case"compile":return"Building and running preview";case"done":return"";case"set_title":return String((t==null?void 0:t.title)??"");default:return""}}function wo(e){return e>=1e3?`${(e/1e3).toFixed(1)}k chars`:`${e} chars`}function _o(e,t,o){const n=(t==null?void 0:t.trim())??"";if(!n)return o?"Needs attention":"";if(o)return un(n).slice(0,160);switch(e){case"write_file":return"File saved";case"edit_file":case"multi_edit":return"Changes applied";case"delete_file":return"File removed";case"compile":return n.includes("Compilation + runtime check passed")?"Build and runtime check passed":n.includes("with warnings")?"Passed with warnings":un(n).slice(0,160);case"set_title":{const i=Iu(n,"title");return i?`Project named "${i}"`:"Title updated"}case"done":return"";default:return un(n).slice(0,160)}}function un(e){var t;return((t=e.split(`
`).find(o=>o.trim()))==null?void 0:t.trim())??""}function Iu(e,t){try{const n=JSON.parse(e)[t];return typeof n=="string"?n.trim():""}catch{return""}}const Au=750;function Ru(e){var o;const t=[...e].reverse().find(n=>n.role==="assistant");return!!((o=t==null?void 0:t.timeline)!=null&&o.some(n=>n.type==="tool_call"&&n.toolStatus==="running"))}function pn(e){return e.map(t=>{var o;return t.role!=="assistant"||!((o=t.timeline)!=null&&o.some(n=>n.type==="tool_call"&&n.toolStatus==="running"))?t:{...t,timeline:t.timeline.map(n=>n.type==="tool_call"&&n.toolStatus==="running"?{...n,toolStatus:"done"}:n)}})}function rp(){var On,Dn,Bn,Fn,Un,Wn,Hn,qn,Gn;const{user:e,loading:t}=So(),o=Ts(),{projectId:n}=Ns(),i=Is(),r=i.state??{},[l]=y.useState(!!r.prompt),h=r.prompt||"",a=Bt(r.thinkingLevel),[m,f]=y.useState(r.title??"");Ds(m||"Project",{description:"Build, preview, refine, export, and deploy an OpenThorn project."});const[u,v]=y.useState([]),[b,w]=y.useState(r.selectedModel??null),[_,A]=y.useState(a),[k,j]=y.useState(!1),[I,S]=y.useState(()=>r.prompt?[{id:"initial-user",role:"user",content:r.prompt,timeline:[]}]:[]),[N,L]=y.useState(!1),[H,$]=y.useState(!1),[P,R]=y.useState(!1),C=y.useRef(!1),D=y.useRef(null),[te,ne]=y.useState(""),[X,ye]=y.useState(!1),[Ue,Ze]=y.useState("preview"),[Ne,We]=y.useState("desktop"),[oe,Ce]=y.useState(!1),[be,ce]=y.useState(null),[me,Qe]=y.useState(""),[Ie,gt]=y.useState(""),[re,Ee]=y.useState("idle"),[yt,Ae]=y.useState([]),[et,tt]=y.useState(Mt.path),[fe,Re]=y.useState(()=>new Set),[de,nt]=y.useState(!1),[ue,ot]=y.useState(!1),[bt,ve]=y.useState(!1),[pe,we]=y.useState(""),[_e,Le]=y.useState("edit"),[ie,ae]=y.useState([]),[Me,st]=y.useState(""),[He,M]=y.useState(""),[q,W]=y.useState(""),[kn,vt]=y.useState(!1),[Ko,Ft]=y.useState(!1),[Pe,xn]=y.useState(null),[it,jn]=y.useState("owner"),[ge,Ut]=y.useState("idle"),[$e,Jo]=y.useState(""),[Yo,Sn]=y.useState(""),[Xo,Wt]=y.useState(!1),[Zo,wt]=y.useState(!1),[Ht,qt]=y.useState(""),[_t,Cn]=y.useState(!1),[En,rt]=y.useState(""),[Qo,Tn]=y.useState(!1),[es,Gt]=y.useState(()=>typeof window<"u"&&new URLSearchParams(window.location.search).has("backend")),[kt,ts]=y.useState(!1),[ke,ns]=y.useState(null),[zt,Nn]=y.useState(null),xt=y.useRef(null),Vt=y.useRef(!0),qe=y.useRef(!1),Ge=y.useRef(null),jt=y.useRef([]),at=y.useRef(null),Kt=y.useRef(!1),St=y.useRef(!1),ze=y.useRef(null),[Ct,Jt]=y.useState(!1),os=y.useRef(h),ss=y.useRef(r.selectedModel),is=y.useRef(a),rs=y.useRef(!!r.isTemplate),as=y.useRef(r.templateName??""),Yt=y.useRef(null),In=y.useRef("refine"),he=y.useRef(null),An=y.useRef(0),Rn=y.useRef(Promise.resolve()),Et=y.useRef(Promise.resolve()),Ve=u.find(c=>c.path===et)??u[0]??Mt,Ln=((Dn=(On=e==null?void 0:e.user_metadata)==null?void 0:On.full_name)==null?void 0:Dn.charAt(0).toUpperCase())??((Bn=e==null?void 0:e.email)==null?void 0:Bn.charAt(0).toUpperCase())??"U",Tt=((Fn=e==null?void 0:e.user_metadata)==null?void 0:Fn.avatar_url)??((Un=e==null?void 0:e.user_metadata)==null?void 0:Un.picture),ls=((Wn=e==null?void 0:e.user_metadata)==null?void 0:Wn.full_name)??((Hn=e==null?void 0:e.email)==null?void 0:Hn.split("@")[0])??"You",cs=(e==null?void 0:e.email)??"Project owner",Q=it==="view",Xt=it==="owner",ds=Xt&&pe.trim().length>0&&!kn,us=it==="owner"?"Owner":it==="edit"?"Edit access":"View-only",Zt=y.useMemo(()=>Me||(typeof window>"u"||!n?"":new URL(`/projects/${n}`,window.location.origin).toString()),[n,Me]);y.useEffect(()=>{!t&&!e&&o("/",{replace:!0})},[t,e,o]),y.useEffect(()=>()=>{var c;(c=Ge.current)==null||c.abort()},[]),y.useEffect(()=>{o(i.pathname,{replace:!0,state:null})},[]),y.useEffect(()=>{var c;(c=r.templateFiles)!=null&&c.length&&(v(r.templateFiles),ye(!0),qe.current=!0)},[]),y.useEffect(()=>{tt(c=>{var g;return u.some(p=>p.path===c)?c:((g=u[0])==null?void 0:g.path)??Mt.path}),Re(c=>{const g=new Set(c);for(const p of u){const E=p.path.split("/");for(let T=0;T<E.length-1;T+=1)g.add(E.slice(0,T+1).join("/"))}return g})},[u]),y.useEffect(()=>{if(!e||!n)return;(async()=>{var g;try{const{data:p,error:E}=await F.from("projects").select("user_id, title, files, chat_history, agent_history, cf_pages_project_name, generating, generating_by, selected_model").eq("id",n).maybeSingle();if(E)throw E;if(p&&p.user_id!==e.id){const{data:le,error:Te}=await F.from("project_collaborators").select("permission").eq("project_id",n).eq("user_id",e.id).maybeSingle();if(Te||!le){o("/dashboard",{replace:!0});return}if(jn(le.permission==="view"?"view":"edit"),Array.isArray(p.files)&&p.files.length>0&&(v(p.files),ye(!0),qe.current=!0),Array.isArray(p.chat_history)&&p.chat_history.length>0){const De=p.chat_history;S(pn(De)),De.some(It=>It.role==="assistant")&&(St.current=!0)}j(!0),p.title&&p.title!=="Untitled project"&&f(p.title),Jt(!0);return}if(jn("owner"),p&&Array.isArray(p.files)&&p.files.length>0){const le=p.files;v(le),ye(!0),qe.current=!0}const T=p&&Array.isArray(p.chat_history)&&p.chat_history.length>0?p.chat_history:null,B=!!(p!=null&&p.generating&&(p==null?void 0:p.generating_by)===e.id),G=!!(T&&Ru(T)),ee=B||G;if(T!=null&&T.some(le=>le.role==="assistant")&&(St.current=!0),ee&&T){const le=[...T].reverse().find(Te=>Te.role==="user");if(le){const Te=((g=T[T.length-1])==null?void 0:g.role)==="assistant"?T.slice(0,-1):T;S(Te),Yt.current=le.content,In.current=Array.isArray(p==null?void 0:p.files)&&p.files.length>0?"refine":"create",Kt.current=!0,$(!0),qe.current=!0}else S(pn(T))}else T&&S(pn(T));!ee&&Array.isArray(p==null?void 0:p.agent_history)&&p.agent_history.length>0&&(jt.current=p.agent_history),ee&&F.from("projects").update({generating:!1,generating_by:null}).eq("id",n),j(!0),p!=null&&p.title&&p.title!=="Untitled project"&&f(p.title),Nn(typeof(p==null?void 0:p.cf_pages_project_name)=="string"?p.cf_pages_project_name:null),!r.selectedModel&&(p!=null&&p.selected_model)&&w(p.selected_model);const{error:O}=await F.from("projects").upsert({id:n,user_id:e.id,title:(p==null?void 0:p.title)??"Untitled project",preview_url:null,created_at:new Date().toISOString()},{onConflict:"id"});if(O)throw O;Jt(!0)}catch(p){J("ProjectLoad",p),S(E=>E.length>0?E:[{id:"project-load-error",role:"assistant",content:"I could not load this project. Please go back to the dashboard and try opening it again.",timeline:[],error:!0}]),j(!0),Jt(!0)}})()},[e==null?void 0:e.id,n,o]),y.useEffect(()=>{if(!e||!n)return;let c=!1;return(async()=>{try{const{data:p,error:E}=await F.from("project_collaborators").select("*").eq("project_id",n).order("invited_at",{ascending:!1});if(c)return;if(E){if(!/does not exist|schema cache|permission denied/i.test(E.message))throw E;return}if(!p)return;ae(p.map(T=>{const B=String(T.email??"collaborator@bloom.app");return{id:String(T.user_id??T.id??B),email:B,name:String(T.name??T.full_name??B.split("@")[0]),permission:T.permission==="view"?"view":"edit",invitedAt:String(T.invited_at??T.created_at??new Date().toISOString()),accountVerified:!0}}))}catch(p){J("ProjectLoadCollaborators",p),W(Se(p,"Could not load collaborators."))}})(),()=>{c=!0}},[n,e==null?void 0:e.id]);const Qt=y.useCallback(async()=>{if(!n)return;const{data:c}=await F.from("project_backends").select("supabase_url, supabase_anon_key").eq("project_id",n).maybeSingle();ts(!!c),ns(c?{url:c.supabase_url,anonKey:c.supabase_anon_key}:null)},[n]);y.useEffect(()=>{Qt()},[Qt]);const ps=((qn=e==null?void 0:e.user_metadata)==null?void 0:qn.full_name)??((Gn=e==null?void 0:e.email)==null?void 0:Gn.split("@")[0])??"Unknown",{onlineCollaborators:Mn}=Ha({projectId:n,userId:e==null?void 0:e.id,userName:ps,userEmail:(e==null?void 0:e.email)??"",onFilesUpdate:c=>{N||v(g=>{const p=c;return g.length===p.length&&g.every((E,T)=>E.path===p[T].path&&E.code===p[T].code)?g:p})},onChatUpdate:c=>{!N&&!Kt.current&&S(c)},onGeneratingChange:(c,g)=>{g!==null&&g===(e==null?void 0:e.id)||R(c)}});y.useEffect(()=>{if(!Pe)return;const c=g=>{g.target.closest(`.${d.presenceAvatars}`)||xn(null)};return document.addEventListener("mousedown",c),()=>document.removeEventListener("mousedown",c)},[Pe]),y.useEffect(()=>{ue&&xt.current&&(xt.current.focus(),xt.current.select())},[ue]),y.useEffect(()=>{re==="ready"&&me&&gt(me)},[re,me]),y.useEffect(()=>{if(N)return;let c=!1;return(async()=>{if(u.length===0){Qe(""),Ae([]),Ee("idle");return}Ee("building"),Ae([]);try{const p=await ht(u.map(E=>({path:E.path,content:E.code})),void 0,{instrument:!0,backend:ke??void 0});if(c)return;p.errors.length>0?(Ae(p.errors),Ee("error")):(Qe(p.html),Ee("ready"))}catch(p){if(c)return;Ae([p instanceof Error?p.message:String(p)]),Ee("error")}})(),()=>{c=!0}},[u,N,ke]);const en=oe&&!be;y.useEffect(()=>{var g;const c=he.current;(g=c==null?void 0:c.contentWindow)==null||g.postMessage({__openthornEdit:en?"enable":"disable"},"*")},[en,me]),y.useEffect(()=>{oe||ce(null)},[oe]),y.useEffect(()=>{if(!oe)return;const c=()=>{be?ce(null):Ce(!1)},g=E=>{E.key==="Escape"&&c()},p=E=>{var T;((T=E.data)==null?void 0:T.__openthornEdit)==="escape"&&c()};return window.addEventListener("keydown",g),window.addEventListener("message",p),()=>{window.removeEventListener("keydown",g),window.removeEventListener("message",p)}},[oe,be]),y.useEffect(()=>{const c=g=>{const p=g.data;!p||!p.__openthornEdit||p.__openthornEdit==="selected"&&p.payload&&ce(p.payload)};return window.addEventListener("message",c),()=>window.removeEventListener("message",c)},[]),y.useEffect(()=>{N&&oe&&(Ce(!1),ce(null))},[N,oe]),y.useEffect(()=>{!e||!n||!X||Q||(Et.current=Et.current.then(async()=>{const{error:c}=await F.from("projects").update({files:u}).eq("id",n);if(c)throw c}).catch(c=>J("ProjectSaveFiles",c)))},[u,e,n,X,Q]),y.useEffect(()=>{if(!e||!n||!k||Q||!I.some(E=>E.role==="assistant"))return;const g=Math.max(0,Au-(Date.now()-An.current)),p=setTimeout(()=>{An.current=Date.now(),Rn.current=Rn.current.then(async()=>{const{error:E}=await F.from("projects").update({chat_history:I}).eq("id",n);if(E)throw E}).catch(E=>J("ProjectSaveChat",E))},g);return()=>clearTimeout(p)},[I,e,n,k,Q]),y.useEffect(()=>{if(!e||!n||re!=="ready"||!me||Q)return;(async()=>{try{const g=await ht(u.map(G=>({path:G.path,content:G.code})),void 0,ke?{backend:ke}:void 0);if(g.errors.length>0){J("ProjectPreviewBuild",g.errors);return}const p=await vi(g.html);if(!p){console.warn("Preview screenshot capture failed, skipping thumbnail");return}const E=`previews/${n}/${Date.now()}/thumbnail.png`,{error:T}=await F.storage.from("deployments").upload(E,p,{contentType:"image/png",upsert:!1,cacheControl:"3600"});if(T)throw T;const{data:B}=F.storage.from("deployments").getPublicUrl(E);if(B!=null&&B.publicUrl){const{error:G}=await F.from("projects").update({preview_url:B.publicUrl}).eq("id",n).eq("user_id",e.id);if(G)throw G}}catch(g){J("ProjectSavePreview",g)}})()},[re,me,e,n,Q,u,m,ke]);const hs=y.useCallback(async()=>{var c,g;if(!(!e||_t)){Cn(!0),rt("");try{const{data:p,error:E}=await F.from("projects").select("preview_url").eq("id",n).maybeSingle();if(E)throw E;const T=((c=e.user_metadata)==null?void 0:c.full_name)??((g=e.email)==null?void 0:g.split("@")[0])??"Anonymous",{error:B}=await F.from("community_posts").insert({project_id:n,user_id:e.id,title:m||"Untitled project",description:Ht.trim()||null,preview_url:(p==null?void 0:p.preview_url)??null,author_name:T,files_snapshot:u});if(B)throw B;wt(!1),qt(""),Tn(!0),setTimeout(()=>Tn(!1),3e3)}catch(p){J("ProjectPublish",p),rt(Se(p,"Could not publish this project. Please try again."))}finally{Cn(!1)}}},[e,_t,n,m,Ht,u]),Pn=y.useCallback(async()=>{Ut("deploying"),Sn(""),Wt(!0);try{const c=await ht(u.map(p=>({path:p.path,content:p.code})),void 0,ke?{backend:ke}:void 0);if(c.errors.length>0)throw new Error(`Build failed: ${c.errors[0]}`);const g=await ei(n,c.html,zt);if(Jo(g.url),g.siteId!==zt&&e&&n){const{error:p}=await F.from("projects").update({cf_pages_project_name:g.siteId}).eq("id",n).eq("user_id",e.id);if(p)throw new Error(`Deploy succeeded, but saving the site failed: ${p.message}`);Nn(g.siteId)}Ut("deployed")}catch(c){Sn(c instanceof Error?c.message:"Deploy failed"),Ut("error")}},[zt,u,n,e,ke]),ms=y.useCallback(async()=>{const c=new Qs;u.forEach(T=>{c.file(T.path,T.code)});const g=await c.generateAsync({type:"blob"}),p=URL.createObjectURL(g),E=document.createElement("a");E.href=p,E.download=`${m.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"project"}.zip`,document.body.appendChild(E),E.click(),document.body.removeChild(E),URL.revokeObjectURL(p)},[u,m]),Nt=y.useCallback(()=>typeof window>"u"||!n?"":new URL(`/projects/${n}`,window.location.origin).toString(),[n]),$n=y.useCallback(async c=>{const g=c.trim().toLowerCase(),{data:p,error:E}=await F.rpc("find_account_by_email",{lookup_email:g});if(E)throw E;const T=Array.isArray(p)?p[0]:p;return T?{id:String(T.id),name:String(T.full_name??g.split("@")[0])}:null},[]),fs=y.useCallback(async c=>{var B;c.preventDefault(),W(""),M(""),Ft(!1);const g=pe.trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g)){W("Enter a valid email address.");return}if(g===((B=e==null?void 0:e.email)==null?void 0:B.toLowerCase())){W("You already own this project.");return}if(ie.some(G=>G.email.toLowerCase()===g)){W("That collaborator is already invited.");return}vt(!0);let p;try{p=await $n(g)}catch(G){J("ProjectFindCollaborator",G),vt(!1),W(Se(G,"Could not look up that account."));return}if(!p){vt(!1),W("No OpenThorn account found for that email.");return}const E=Nt(),T=new Date().toISOString();if(ae(G=>[{id:p.id,email:g,name:p.name,permission:_e,invitedAt:T,accountVerified:!0},...G]),st(E),we(""),M(`${p.name} was invited with ${_e==="edit"?"edit":"view-only"} access.`),vt(!1),n){const{error:G}=await F.from("project_collaborators").upsert({project_id:n,user_id:p.id,email:g,permission:_e,invited_by:e==null?void 0:e.id,invited_at:T},{onConflict:"project_id,user_id"});G&&!/does not exist|schema cache|permission denied/i.test(G.message)&&(J("ProjectPersistCollaborator",G),ae(ee=>ee.filter(O=>O.id!==p.id)),M(""),W(Se(G,"Could not invite this collaborator.")))}},[Nt,ie,$n,pe,_e,n,e]),gs=y.useCallback((c,g)=>{const p=ie;ae(T=>T.map(B=>B.id===c?{...B,permission:g}:B));const E=ie.find(T=>T.id===c);n&&E&&F.from("project_collaborators").update({permission:g}).eq("project_id",n).eq("user_id",c).then(({error:T})=>{T&&!/does not exist|schema cache|permission denied/i.test(T.message)&&(J("ProjectUpdateCollaborator",T),ae(p),W(Se(T,"Could not update collaborator permissions.")))},T=>{J("ProjectUpdateCollaborator",T),ae(p),W(Se(T,"Could not update collaborator permissions."))})},[ie,n]),ys=y.useCallback(c=>{const g=ie;ae(p=>p.filter(E=>E.id!==c)),n&&F.from("project_collaborators").delete().eq("project_id",n).eq("user_id",c).then(({error:p})=>{p&&!/does not exist|schema cache|permission denied/i.test(p.message)&&(J("ProjectRemoveCollaborator",p),ae(g),W(Se(p,"Could not remove this collaborator.")))},p=>{J("ProjectRemoveCollaborator",p),ae(g),W(Se(p,"Could not remove this collaborator."))})},[ie,n]),bs=y.useCallback(async()=>{const c=Zt||Nt();if(Me||st(c),navigator.clipboard)try{await navigator.clipboard.writeText(c),Ft(!0),window.setTimeout(()=>Ft(!1),1800)}catch(g){J("ProjectCopyInviteLink",g),W(Se(g,"Could not copy the link."))}},[Nt,Zt,Me]),vs=y.useCallback(c=>{const g=c.trim();g&&g!==m&&(f(g),e&&n&&F.from("projects").update({title:g}).eq("id",n).then(({error:p})=>{p&&J("ProjectSaveTitle",p)},p=>J("ProjectSaveTitle",p))),ot(!1)},[m,e,n]),xe=y.useCallback((c,g)=>{S(p=>p.map(E=>E.id===c?{...E,...g}:E))},[]),ws=y.useCallback(()=>{var c;ze.current=null,ne("Cancelling..."),(c=Ge.current)==null||c.abort()},[]),Oe=y.useCallback(async(c,g,p=_,E={})=>{var Vn,Kn,Jn;if(!e||Q)return;if($(!1),Ge.current||P){ze.current={prompt:c,model:g,thinkingLevel:p},S(V=>[...V,{id:`user-queued-${Date.now()}`,role:"user",content:E.displayContent??c,timeline:[]}]);return}const T=`${Date.now()}-${Math.random().toString(36).slice(2)}`,B=`assistant-${T}`,G=g??b,ee=p;w(G),A(ee);const O=[];let le=0;const Te=St.current;S(V=>[...E.reuseInitialUser?V:[...V,{id:`user-${T}`,role:"user",content:E.displayContent??c,timeline:[]}],{id:B,role:"assistant",title:"OpenThorn",timeline:[]}]);const De=V=>{const K={...V,id:`ev-${le++}`,timestamp:Date.now()};O.push(K),xe(B,{timeline:[...O]})},It=(V,K="info")=>{const U=V.trim();if(!U)return;const x=O[O.length-1];(x==null?void 0:x.type)==="status"&&x.text===U||De({type:"status",text:U,statusTone:K})},zn=(V,K)=>{if(V){const x=O.findIndex(lt=>lt.type==="tool_call"&&lt.toolCallId===V);if(x!==-1)return x}const U=O.findIndex(x=>x.type==="tool_call"&&x.toolLabel===K&&x.toolStatus==="running");if(U!==-1)return U;for(let x=O.length-1;x>=0;x--)if(O[x].type==="tool_call"&&O[x].toolLabel===K)return x;return-1},tn=(V,K,U)=>{const x=zn(U,V);return x!==-1?(O[x]={...O[x],...K},xe(B,{timeline:[...O]}),!0):!1},js=(V,K,U)=>{const x=zn(U,V);return x!==-1?(O[x]={...K,id:O[x].id,timestamp:O[x].timestamp},xe(B,{timeline:[...O]}),!0):!1},Ke=new AbortController;at.current={controller:Ke,files:vo(u),firstRunComplete:X},Ge.current=Ke,St.current=!0,L(!0),ne("Connecting..."),n&&F.from("projects").update({generating:!0,generating_by:e.id}).eq("id",n);try{const K=rs.current&&!I.some(x=>x.role==="assistant")?`<system-reminder>
TEMPLATE MODE: This project was started from the "${as.current||"template"}" template. The existing files are the template foundation — build upon them. Preserve the color system, component structure, and design language. Do not delete template files unless the user explicitly requests it.
</system-reminder>

${c}`:c,U=await ga({userId:e.id,prompt:K,title:m,files:u.length>0?u:[Mt],selectedModel:G,thinkingLevel:ee,mode:E.mode??"refine",signal:Ke.signal,history:jt.current.length>0?jt.current:void 0,projectId:n,hasBackend:kt,backendConfig:ke??void 0,onProgress:x=>{var lt;if(x.type==="text"&&x.text){const z=O[O.length-1];z&&z.type==="text"?(z.text=(z.text||"")+x.text,xe(B,{timeline:[...O]})):De({type:"text",text:x.text})}if(x.type==="title"&&x.text&&!Te&&(f(x.text),It(`Project title set to "${x.text}".`,"success"),e&&n&&F.from("projects").update({title:x.text}).eq("id",n).then(({error:z})=>{z&&J("ProjectSaveTitle",z)},z=>J("ProjectSaveTitle",z))),x.type==="generating"&&ne(x.toolName?Pt(x.toolName,x.toolInput):"Thinking..."),x.type==="tool_start"&&x.toolName){const z=Pt(x.toolName,x.toolInput);As.flushSync(()=>{De({type:"tool_call",toolLabel:z,toolCallId:x.toolCallId,toolStatus:"running",toolDetail:Nu(x.toolName,x.toolInput)}),ne(z)})}if(x.type==="tool_result"&&x.toolName){if(x.toolName==="think"){const z=Pt(x.toolName,x.toolInput);x.toolError?tn(z,{toolStatus:"error",toolDetail:_o(x.toolName,x.toolResult,x.toolError)},x.toolCallId):(lt=x.toolResult)!=null&&lt.trim()?js(z,{type:"thinking",thought:x.toolResult,thinkingCollapsed:!0},x.toolCallId)||De({type:"thinking",thought:x.toolResult,thinkingCollapsed:!0}):tn(z,{toolStatus:"done"},x.toolCallId)}else{const z=Pt(x.toolName,x.toolInput);tn(z,{toolStatus:x.toolError?"error":"done",toolDetail:_o(x.toolName,x.toolResult,x.toolError)},x.toolCallId)}if(x.toolName==="done"&&x.toolResult)try{const z=JSON.parse(x.toolResult);!Te&&z.title&&typeof z.title=="string"&&z.title.trim()&&(f(z.title.trim()),e&&n&&F.from("projects").update({title:z.title.trim()}).eq("id",n).then(({error:ct})=>{ct&&J("ProjectSaveTitle",ct)},ct=>J("ProjectSaveTitle",ct))),typeof z.summary=="string"&&z.summary.trim()&&xe(B,{summary:z.summary.trim()})}catch{}}x.type==="status"&&x.message&&(ne(x.message),It(x.message)),(x.type==="files"||x.type==="done")&&x.files&&(v(x.files),(x.type==="files"||x.filesMutated)&&ye(!0))}});v(U.files),U.filesMutated&&ye(!0),jt.current=U.conversationHistory,n&&!Q&&F.from("projects").update({agent_history:U.conversationHistory}).eq("id",n).then(({error:x})=>{x&&J("ProjectSaveAgentHistory",x)},x=>J("ProjectSaveAgentHistory",x)),ne("");for(let x=O.length-1;x>=0;x--)O[x].type==="tool_call"&&O[x].toolStatus==="running"&&(O[x]={...O[x],toolStatus:"done"});xe(B,{title:U.filesMutated?"Project ready":void 0,timeline:[...O],files:U.filesMutated?U.files:void 0,turns:U.turns,providerName:U.providerName,modelName:U.modelName})}catch(V){if(Bs(V)){const K=((Vn=at.current)==null?void 0:Vn.controller)===Ke?at.current:null;if(K){const U=vo(K.files);v(U),ye(K.firstRunComplete),n&&!Q&&(Et.current=Et.current.then(async()=>{const{error:x}=await F.from("projects").update({files:U}).eq("id",n);if(x)throw x}).catch(x=>J("ProjectRestoreFilesAfterAbort",x)))}ne("");for(let U=O.length-1;U>=0;U--)O[U].type==="tool_call"&&O[U].toolStatus==="running"&&(O[U]={...O[U],toolStatus:"error"});O.some(U=>U.type==="status"&&U.text==="Request cancelled.")||O.push({id:`ev-${le++}`,timestamp:Date.now(),type:"status",text:"Request cancelled."}),xe(B,{title:"Request cancelled",timeline:[...O]});return}J("ProjectAgentRun",V),ne("");for(let K=O.length-1;K>=0;K--)O[K].type==="tool_call"&&O[K].toolStatus==="running"&&(O[K]={...O[K],toolStatus:"error"});xe(B,{title:"Something went wrong",timeline:[...O],errorInfo:Fs(V,G==null?void 0:G.model_id),error:!0})}finally{Ge.current===Ke&&(Ge.current=null),((Kn=at.current)==null?void 0:Kn.controller)===Ke&&(at.current=null),n&&F.from("projects").update({generating:!1,generating_by:null}).eq("id",n),L(!1);const V=ze.current;V&&(ze.current=null,(Jn=D.current)==null||Jn.call(D,V.prompt,V.model,V.thinkingLevel,{reuseInitialUser:!0}))}},[_,X,Q,u,n,r.selectedModel,m,xe,e]);y.useEffect(()=>{D.current=Oe},[Oe]);const _s=y.useCallback((c,g)=>{if(Q)return;const p=Yn(c,`change text to "${g}"`),E=zs(u.map(ee=>ee.path),c.oeid),T=E?u.find(ee=>ee.path===E):void 0,B=T?Vs(T.code,c.text,g):null;if(!T||B==null){ce(null),Ce(!1),Oe(Xn(c,`Change the text to: ${g}`),b,_,{mode:"refine",displayContent:p});return}const G=u.map(ee=>ee.path===E?{...ee,code:B}:ee);v(G),S(ee=>[...ee,{id:`user-textedit-${Date.now()}`,role:"user",content:p,timeline:[]},{id:`assistant-textedit-${Date.now()}`,role:"assistant",title:"OpenThorn",summary:`Updated the text to “${g}”.`,timeline:[],files:G}]),ce(null)},[Q,u,b,_,Oe]);y.useEffect(()=>{const c=Yt.current;if(!c||!Ct||!k||!e||Q)return;Yt.current=null,Kt.current=!1;const g=setTimeout(()=>{var p;(p=D.current)==null||p.call(D,c,b,_,{reuseInitialUser:!0,mode:In.current})},100);return()=>clearTimeout(g)},[Ct,k,e,Q]),y.useEffect(()=>{var g;const c=C.current;if(C.current=P,c&&!P&&!N){const p=ze.current;p&&(ze.current=null,(g=D.current)==null||g.call(D,p.prompt,p.model,p.thinkingLevel,{reuseInitialUser:!0}))}},[P,N]),y.useEffect(()=>{if(!Ct||!k||!e||Q||qe.current||!l)return;qe.current=!0;const c=os.current,g=ss.current,p=is.current,E=setTimeout(()=>{Oe(c,g??null,p,{reuseInitialUser:!0,mode:"create"})},100);return()=>clearTimeout(E)},[Ct,k,e,Q,l]);const ks=y.useMemo(()=>Tu(u),[u]),xs=y.useCallback(c=>{Re(g=>{const p=new Set(g);return p.has(c)?p.delete(c):p.add(c),p})},[]),je=re==="error"&&N?"building":re;return t?null:s.jsxs(s.Fragment,{children:[s.jsxs("div",{className:d.root,children:[s.jsxs("header",{className:d.topbar,children:[s.jsxs("div",{className:d.topbarLeft,children:[s.jsx("button",{className:d.backBtn,type:"button",onClick:()=>o("/dashboard"),"aria-label":"Back to dashboard",children:s.jsxs("svg",{width:"18",height:"18",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[s.jsx("path",{d:"M19 12H5"}),s.jsx("path",{d:"M12 19l-7-7 7-7"})]})}),s.jsxs("div",{className:d.brandCluster,children:[s.jsx("img",{src:"/assets/logo.png",alt:"OpenThorn",className:d.logo}),s.jsxs("div",{children:[ue?s.jsx("input",{ref:xt,className:d.projectNameInput,defaultValue:m,onBlur:c=>{Vt.current?vs(c.currentTarget.value):ot(!1),Vt.current=!0},onKeyDown:c=>{c.key==="Enter"&&c.currentTarget.blur(),c.key==="Escape"&&(Vt.current=!1,c.currentTarget.blur())}}):s.jsx("button",{type:"button",className:d.projectNameBtn,onClick:()=>{Q||ot(!0)},title:Q?void 0:"Click to rename",children:m||"Untitled project"}),s.jsxs("div",{className:d.projectMeta,children:[X?`${u.length} file${u.length!==1?"s":""}`:"New project"," · ",us]})]})]})]}),s.jsx("div",{className:d.topbarCenter,children:s.jsxs("div",{className:d.modeSwitch,"aria-label":"View mode",children:[s.jsxs("button",{className:Ue==="preview"?d.modeActive:"",type:"button",onClick:()=>Ze("preview"),children:[s.jsx($u,{}),"Preview"]}),s.jsxs("button",{className:Ue==="code"?d.modeActive:"",type:"button",onClick:()=>Ze("code"),children:[s.jsx(Ou,{}),"Code"]})]})}),s.jsxs("div",{className:d.topActions,children:[s.jsx("button",{className:d.iconBtn,type:"button","aria-label":"Download project as ZIP",onClick:ms,disabled:!X||N||P,children:s.jsx(Du,{})}),Mn.length>0&&s.jsxs("div",{className:d.presenceAvatars,"aria-label":"Online collaborators",children:[Mn.slice(0,4).map(c=>s.jsx("button",{type:"button",className:d.presenceAvatar,style:{background:dn(c.userId),"--avatar-color":dn(c.userId)},"aria-label":`${c.name} — click for info`,onClick:()=>xn(g=>(g==null?void 0:g.userId)===c.userId?null:c),children:c.initials},c.userId)),Pe&&s.jsxs("div",{className:d.presencePopover,children:[s.jsx("div",{className:d.presencePopoverAvatar,style:{background:dn(Pe.userId)},children:Pe.initials}),s.jsx("div",{className:d.presencePopoverName,children:Pe.name}),s.jsx("div",{className:d.presencePopoverEmail,children:Pe.email})]})]}),s.jsxs("button",{className:d.shareBtn,type:"button",onClick:()=>ve(!0),children:[s.jsx(Bu,{}),"Share"]}),s.jsxs("button",{className:d.publishBtn,type:"button",onClick:()=>{qt(""),rt(""),wt(!0)},disabled:!X,title:X?"Publish to Community":"Build the project first before publishing",children:[s.jsxs("svg",{width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[s.jsx("path",{d:"M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"}),s.jsx("polyline",{points:"17 8 12 3 7 8"}),s.jsx("line",{x1:"12",y1:"3",x2:"12",y2:"15"})]}),"Publish"]}),s.jsxs("button",{className:d.publishBtn,type:"button",onClick:()=>Gt(!0),title:kt?"Backend connected":"Connect a Supabase backend (database + accounts)",style:kt?{background:"#16a34a",borderColor:"#16a34a",color:"#fff"}:void 0,children:[s.jsxs("svg",{width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[s.jsx("ellipse",{cx:"12",cy:"5",rx:"9",ry:"3"}),s.jsx("path",{d:"M3 5v14a9 3 0 0 0 18 0V5"}),s.jsx("path",{d:"M3 12a9 3 0 0 0 18 0"})]}),kt?"Backend ✓":"Backend"]}),s.jsx("button",{className:`${d.deployBtn} ${ge==="deployed"?d.deployBtnDeployed:""}`,type:"button",onClick:ge==="deployed"?()=>window.open($e,"_blank"):Pn,disabled:ge==="deploying"||!X||N||P,children:ge==="deploying"?s.jsxs(s.Fragment,{children:[s.jsx("span",{className:d.spinner}),"Deploying…"]}):ge==="deployed"?s.jsxs(s.Fragment,{children:["View site ",s.jsx(ko,{})]}):s.jsx(s.Fragment,{children:"Deploy"})})]})]}),bt&&s.jsx("div",{className:d.shareOverlay,role:"presentation",onMouseDown:c=>{c.target===c.currentTarget&&ve(!1)},children:s.jsxs("section",{className:d.shareDialog,role:"dialog","aria-modal":"true","aria-labelledby":"share-dialog-title",children:[s.jsxs("div",{className:d.shareHeader,children:[s.jsx("div",{children:s.jsxs("h2",{id:"share-dialog-title",children:["Share ",m]})}),s.jsx("button",{className:d.closeBtn,type:"button","aria-label":"Close share dialog",onClick:()=>ve(!1),children:s.jsx(hn,{})})]}),Xt?s.jsxs("form",{className:d.inviteForm,onSubmit:fs,children:[s.jsx("label",{className:d.inviteLabel,htmlFor:"collaborator-email",children:"Invite by email"}),s.jsxs("div",{className:d.inviteRow,children:[s.jsxs("div",{className:d.emailInputWrap,children:[s.jsx(Fu,{}),s.jsx("input",{id:"collaborator-email",type:"email",value:pe,onChange:c=>{we(c.target.value),W(""),M("")},placeholder:"teammate@company.com",autoComplete:"email"})]}),s.jsxs("div",{className:d.permissionToggle,"aria-label":"Invite permission",children:[s.jsx("button",{className:_e==="view"?d.permissionActive:"",type:"button",onClick:()=>Le("view"),children:"View"}),s.jsx("button",{className:_e==="edit"?d.permissionActive:"",type:"button",onClick:()=>Le("edit"),children:"Edit"})]}),s.jsx("button",{className:d.inviteBtn,type:"submit",disabled:!ds,children:kn?"Checking":"Invite"})]}),s.jsxs("div",{className:d.inviteFeedback,"aria-live":"polite",children:[q&&s.jsx("span",{className:d.inviteError,children:q}),He&&s.jsx("span",{className:d.inviteSuccess,children:He})]})]}):s.jsxs("div",{className:d.readOnlyShare,children:["You have ",it==="edit"?"edit":"view-only"," access. The project owner manages invitations and permissions."]}),s.jsxs("div",{className:d.linkPanel,children:[s.jsx("div",{className:d.linkIcon,children:s.jsx(Uu,{})}),s.jsxs("div",{className:d.linkText,children:[s.jsx("span",{children:"Invite link"}),s.jsx("strong",{children:Zt})]}),s.jsx("button",{className:d.copyBtn,type:"button",onClick:bs,children:Ko?"Copied":"Copy"})]}),s.jsxs("div",{className:d.peoplePanel,children:[s.jsxs("div",{className:d.peopleHeader,children:[s.jsx("h3",{children:"People with access"}),s.jsxs("span",{children:[ie.length+1," total"]})]}),s.jsxs("div",{className:d.personList,children:[s.jsxs("article",{className:d.personItem,children:[s.jsx("div",{className:d.personAvatar,children:Tt?s.jsx("img",{src:Tt,alt:""}):Ln}),s.jsxs("div",{className:d.personInfo,children:[s.jsx("strong",{children:ls}),s.jsx("span",{children:cs})]}),s.jsx("span",{className:d.ownerBadge,children:"Owner"})]}),ie.length===0?s.jsx("div",{className:d.emptyInvites,children:"Invite collaborators to keep feedback, edits, and handoff in one place."}):ie.map(c=>s.jsxs("article",{className:d.personItem,children:[s.jsx("div",{className:d.personAvatar,children:c.name.charAt(0).toUpperCase()}),s.jsxs("div",{className:d.personInfo,children:[s.jsx("strong",{children:c.name}),s.jsxs("span",{children:[c.email," - ",c.accountVerified?"OpenThorn account":"Pending"," - Invited ",new Date(c.invitedAt).toLocaleDateString("en-US",{month:"short",day:"numeric"})]})]}),Xt?s.jsxs(s.Fragment,{children:[s.jsxs("select",{className:d.permissionSelect,value:c.permission,"aria-label":`Permission for ${c.email}`,onChange:g=>gs(c.id,g.target.value),children:[s.jsx("option",{value:"view",children:"Can view"}),s.jsx("option",{value:"edit",children:"Can edit"})]}),s.jsx("button",{className:d.removeBtn,type:"button","aria-label":`Remove ${c.email}`,onClick:()=>ys(c.id),children:s.jsx(Wu,{})})]}):s.jsx("span",{className:d.ownerBadge,children:c.permission==="edit"?"Can edit":"Can view"})]},c.id))]})]})]})}),Xo&&s.jsx("div",{className:d.shareOverlay,role:"presentation",onMouseDown:c=>{c.target===c.currentTarget&&ge!=="deploying"&&Wt(!1)},children:s.jsxs("section",{className:d.deployModal,role:"dialog","aria-modal":"true","aria-labelledby":"deploy-modal-title",children:[s.jsxs("div",{className:d.shareHeader,children:[s.jsx("div",{children:s.jsx("h2",{id:"deploy-modal-title",children:"Deploy project"})}),ge!=="deploying"&&s.jsx("button",{className:d.closeBtn,type:"button","aria-label":"Close",onClick:()=>Wt(!1),children:s.jsx(hn,{})})]}),s.jsxs("div",{className:d.deployBody,children:[ge==="deploying"&&s.jsxs("div",{className:d.deployStatus,children:[s.jsx("span",{className:d.spinnerLarge}),s.jsx("p",{children:"Bundling and deploying your project…"})]}),ge==="deployed"&&s.jsxs("div",{className:d.deployStatus,children:[s.jsx("div",{className:d.deploySuccessIcon,children:s.jsx(Lu,{})}),s.jsx("p",{children:"Your site is live!"}),s.jsx("a",{href:$e,target:"_blank",rel:"noopener noreferrer",className:d.deployUrl,children:$e}),s.jsxs("button",{className:d.deployBtn,type:"button",onClick:()=>window.open($e,"_blank"),children:["View site ",s.jsx(ko,{})]})]}),ge==="error"&&s.jsxs("div",{className:d.deployStatus,children:[s.jsx("p",{className:d.deployError,children:Yo}),s.jsx("button",{className:d.deployBtn,type:"button",onClick:Pn,children:"Retry"})]})]})]})}),es&&s.jsx("div",{className:d.shareOverlay,role:"presentation",onMouseDown:c=>{c.target===c.currentTarget&&Gt(!1)},children:s.jsxs("section",{className:d.deployModal,role:"dialog","aria-modal":"true","aria-labelledby":"backend-modal-title",children:[s.jsxs("div",{className:d.shareHeader,children:[s.jsx("div",{children:s.jsx("h2",{id:"backend-modal-title",children:"Backend"})}),s.jsx("button",{className:d.closeBtn,type:"button","aria-label":"Close",onClick:()=>Gt(!1),children:s.jsx(hn,{})})]}),s.jsx("div",{className:d.deployBody,children:n&&s.jsx(bi,{projectId:n,onStatusChange:()=>{Qt()}})})]})}),s.jsxs("main",{className:d.shell,children:[s.jsxs("aside",{className:d.chatPanel,children:[s.jsxs("div",{className:d.thread,children:[I.map(c=>c.role==="user"?s.jsxs("article",{className:d.userMessage,children:[s.jsx("div",{className:d.avatar,children:Tt?s.jsx("img",{src:Tt,alt:""}):Ln}),s.jsx("div",{className:d.userBubble,children:s.jsx("p",{children:c.content})})]},c.id):s.jsxs("article",{className:`${d.assistantMessage} ${c.error&&!c.errorInfo?d.assistantMessageError:""}`,children:[s.jsxs("div",{className:d.assistantTop,children:[s.jsx("img",{src:"/assets/logo.png",alt:""}),s.jsx("span",{children:c.title??"OpenThorn"})]}),s.jsx("div",{className:d.timeline,children:c.timeline.map(g=>g.type==="text"?s.jsx("div",{className:d.timelineText,children:s.jsx(Mu,{markdown:g.text||""})},g.id):g.type==="thinking"?s.jsx(Pu,{thought:g.thought||"",collapsed:g.thinkingCollapsed!==!1,onToggle:()=>{S(p=>p.map(E=>E.id!==c.id?E:{...E,timeline:E.timeline.map(T=>T.id===g.id?{...T,thinkingCollapsed:!T.thinkingCollapsed}:T)}))}},g.id):g.type==="status"?s.jsx("div",{className:`${d.timelineStatus} ${g.statusTone==="success"?d.timelineStatusSuccess:""}`,children:g.text},g.id):g.type==="tool_call"?s.jsxs("div",{className:`${d.toolCall} ${g.toolStatus==="running"?d.toolCallRunning:""} ${g.toolStatus==="error"?d.toolCallError:""}`,children:[s.jsx("span",{className:d.toolCallIcon,children:g.toolStatus==="done"?s.jsx(ut,{}):g.toolStatus==="error"?s.jsx("span",{className:d.toolCallX,children:"×"}):s.jsx("span",{className:d.miniSpinner})}),s.jsx("span",{className:d.toolCallLabel,children:g.toolLabel}),g.toolDetail&&s.jsx("span",{className:d.toolCallDetail,children:g.toolDetail})]},g.id):null)}),c.errorInfo&&s.jsxs("div",{className:d.errorCard,children:[s.jsxs("div",{className:d.errorCardHeader,children:[s.jsx("span",{className:d.errorCardIcon,"aria-hidden":"true",children:"!"}),s.jsx("span",{className:d.errorCardTitle,children:c.errorInfo.title})]}),c.errorInfo.detail&&s.jsx("p",{className:d.errorCardDetail,children:c.errorInfo.detail}),c.errorInfo.tip&&s.jsxs("p",{className:d.errorCardTip,children:[s.jsx("span",{className:d.errorCardTipLabel,children:"Tip"}),c.errorInfo.tip]})]}),c.summary&&s.jsx("p",{className:d.completionSummary,children:c.summary}),c.turns!=null&&c.turns>0&&s.jsxs("div",{className:d.completionBadge,children:["Built in ",c.turns," turn",c.turns===1?"":"s",c.providerName&&` - ${c.providerName}`,c.modelName&&` / ${c.modelName}`]})]},c.id)),(N||H||P)&&s.jsx("div",{className:d.generatingIndicator,role:"status","aria-label":"Generating",children:s.jsx("span",{className:d.generatingDot,"aria-hidden":"true"})})]}),s.jsx("div",{className:d.composer,children:Q?s.jsx("div",{className:d.viewOnlyNotice,children:"View-only access. Ask the owner for edit permission to make changes."}):s.jsx(Us,{size:"small",page:"dashboard",disableTyping:!0,initialModel:b,initialThinkingLevel:_,modelMenuPlacement:"top",placeholder:H?`Reconnecting to ${(b==null?void 0:b.model_name)??"the model"} — resuming your work…`:N?te||"OpenThorn is working...":P?"A collaborator is generating…":"Ask OpenThorn for a change...",onModelChange:c=>{w(c),n&&c&&F.from("projects").update({selected_model:c}).eq("id",n)},isRunning:N,onCancel:ws,disabled:H||P,onSubmit:(c,g,p)=>{Oe(c,g,p)}})})]}),s.jsxs("section",{className:`${d.previewPane} ${de?d.previewPaneFullscreen:""}`,children:[s.jsxs("div",{className:d.previewToolbar,children:[s.jsxs("div",{className:d.previewCenter,children:[s.jsxs("div",{className:d.deviceSwitch,"aria-label":"Device preview",children:[s.jsx("button",{className:Ne==="desktop"?d.deviceBtnActive:d.deviceBtn,type:"button","aria-label":"Desktop preview",onClick:()=>We("desktop"),children:s.jsx(Hu,{})}),s.jsx("button",{className:Ne==="tablet"?d.deviceBtnActive:d.deviceBtn,type:"button","aria-label":"Tablet preview",onClick:()=>We("tablet"),children:s.jsx(zu,{})}),s.jsx("button",{className:Ne==="phone"?d.deviceBtnActive:d.deviceBtn,type:"button","aria-label":"Phone preview",onClick:()=>We("phone"),children:s.jsx(Vu,{})})]}),s.jsx("div",{className:d.addressBar,children:$e?s.jsxs(s.Fragment,{children:[s.jsx(xo,{}),s.jsxs("span",{children:[new URL($e).hostname,new URL($e).pathname]})]}):s.jsxs(s.Fragment,{children:[s.jsx(xo,{}),s.jsx("span",{children:"/"}),s.jsx(qu,{})]})})]}),s.jsxs("div",{className:d.previewTools,children:[s.jsx("button",{className:`${d.iconBtn} ${oe?d.editToggleActive:""}`,type:"button","aria-pressed":oe,disabled:N||je!=="ready","aria-label":oe?"Exit edit mode":"Edit elements",title:oe?"Exit edit mode":"Click an element to edit it",onClick:()=>Ce(c=>!c),children:s.jsx(jo,{})}),s.jsx("button",{className:d.iconBtn,type:"button","aria-label":de?"Exit fullscreen preview":"Fullscreen preview",onClick:()=>nt(c=>!c),children:de?s.jsx(Ju,{}):s.jsx(Ku,{})})]})]}),Ue==="preview"?s.jsxs("div",{className:d.previewStage,children:[oe&&s.jsxs("div",{className:d.editModeBadge,role:"status",children:[s.jsx(jo,{}),s.jsx("span",{children:be?"Editing element":"Click any element to edit"}),s.jsx("kbd",{children:"Esc"})]}),s.jsx("div",{className:`${d.deviceFrame} ${d[Ne]}`,children:s.jsxs("div",{className:`${d.previewCard} ${oe?d.previewCardEditing:""}`,children:[s.jsxs("div",{className:d.previewChrome,children:[s.jsxs("div",{className:d.previewChromeDots,children:[s.jsx("span",{}),s.jsx("span",{}),s.jsx("span",{})]}),s.jsx("span",{className:d.previewState,children:X?je==="building"?"Building...":je==="error"?"Build failed":je==="ready"?"Live preview":"Waiting for build":H?"Reconnecting…":N?"Agent working":"Waiting for build"})]}),!X&&s.jsxs("div",{className:`${d.previewEmpty} ${d.previewBlank}`,children:[s.jsx("div",{className:d.previewMark,children:s.jsx("img",{src:"/assets/logo.png",alt:""})}),s.jsx("h2",{children:H?`Reconnecting to ${(b==null?void 0:b.model_name)??"the model"}…`:N?"OpenThorn is building...":"Ready when you are"}),s.jsx("p",{children:h}),(N||H)&&s.jsxs("div",{className:d.previewChecklist,children:[s.jsxs("span",{children:[s.jsx(ut,{})," Prompt captured"]}),s.jsxs("span",{children:[s.jsx("span",{className:d.spinnerSmall})," ",H?"Resuming your last request…":te||"Generating project"]})]})]}),X&&je==="building"&&!Ie&&s.jsxs("div",{className:d.previewEmpty,children:[s.jsx("div",{className:d.previewMark,children:s.jsx("img",{src:"/assets/logo.png",alt:""})}),s.jsx("h2",{children:"Building preview..."}),s.jsx("p",{children:h}),s.jsxs("div",{className:d.previewChecklist,children:[s.jsxs("span",{children:[s.jsx(ut,{})," Files updated"]}),s.jsxs("span",{children:[s.jsx("span",{className:d.spinnerSmall})," Compiling..."]})]})]}),X&&je==="error"&&s.jsxs("div",{className:d.previewEmpty,children:[s.jsx("div",{className:d.previewMark,children:s.jsx("img",{src:"/assets/logo.png",alt:""})}),s.jsx("h2",{children:"Build error"}),s.jsx("p",{children:"The preview could not be compiled. Check the code for syntax issues."}),s.jsx("div",{className:d.errorList,children:yt.map((c,g)=>s.jsx("pre",{className:d.errorLine,children:Co(c)},g))})]}),X&&re==="idle"&&s.jsxs("div",{className:d.previewEmpty,children:[s.jsx("div",{className:d.previewMark,children:s.jsx("img",{src:"/assets/logo.png",alt:""})}),s.jsx("h2",{children:"Preview will appear here"}),s.jsx("p",{children:h}),s.jsxs("div",{className:d.previewChecklist,children:[s.jsxs("span",{children:[s.jsx(ut,{})," Layout shell"]}),s.jsxs("span",{children:[s.jsx(ut,{})," Prompt captured"]}),s.jsxs("span",{children:[s.jsx(Gu,{})," Generation pipeline"]})]})]}),X&&(je==="ready"||je==="building"&&Ie)&&s.jsxs("div",{className:d.previewRebuild,onPointerDown:c=>{var g,p,E;c.pointerType!=="touch"&&((g=he.current)==null||g.focus(),(E=(p=he.current)==null?void 0:p.contentWindow)==null||E.focus())},onPointerEnter:c=>{var E,T,B;if(c.pointerType==="touch")return;const g=document.activeElement,p=g==null?void 0:g.tagName;p==="INPUT"||p==="TEXTAREA"||g!=null&&g.isContentEditable||((E=he.current)==null||E.focus(),(B=(T=he.current)==null?void 0:T.contentWindow)==null||B.focus())},children:[je==="building"&&s.jsx("div",{className:d.rebuildOverlay}),s.jsx("iframe",{ref:he,className:d.previewFrame,srcDoc:re==="ready"?me:Ie,sandbox:"allow-scripts allow-forms",title:"Live preview",onLoad:()=>{var g,p,E,T,B;const c=document.activeElement;(c===he.current||c===document.body||c===null)&&((g=he.current)==null||g.focus(),(E=(p=he.current)==null?void 0:p.contentWindow)==null||E.focus()),(B=(T=he.current)==null?void 0:T.contentWindow)==null||B.postMessage({__openthornEdit:en?"enable":"disable"},"*")}})]}),oe&&be&&s.jsx(Pi,{selection:be,frameOffset:(()=>{var g;const c=(g=he.current)==null?void 0:g.getBoundingClientRect();return{top:(c==null?void 0:c.top)??0,left:(c==null?void 0:c.left)??0}})(),busy:N,onClose:()=>ce(null),onTextEdit:(c,g)=>_s(c,g),onSubmit:(c,g)=>{ce(null),Ce(!1),Oe(Xn(g,c),b,_,{mode:"refine",displayContent:Yn(g,c)})}}),X&&re!=="ready"&&!Ie&&s.jsxs("div",{className:d.previewSkeleton,"aria-hidden":"true",children:[s.jsx("div",{className:d.skeletonWide}),s.jsx("div",{}),s.jsx("div",{}),s.jsx("div",{})]})]})})]}):s.jsxs("div",{className:d.codeWorkspace,children:[s.jsxs("aside",{className:d.codeSidebar,children:[s.jsx("div",{className:d.codeSidebarTitle,children:"Explorer"}),s.jsx("div",{className:d.fileTree,children:ks.map(c=>s.jsx(Vo,{node:c,depth:0,activeFile:et,expandedFolders:fe,onSelectFile:tt,onToggleFolder:xs},c.path))})]}),s.jsxs("div",{className:d.editorPane,children:[s.jsx("div",{className:d.editorTabs,children:s.jsxs("div",{className:d.editorTab,children:[s.jsx("span",{className:d.tabIcon,children:s.jsx(Go,{})}),Ve.path.split("/").pop(),s.jsx("button",{className:d.tabClose,type:"button","aria-label":"Close tab",children:s.jsx("svg",{width:"12",height:"12",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",children:s.jsx("path",{d:"M18 6L6 18M6 6l12 12"})})})]})}),s.jsxs("div",{className:d.editorBody,children:[s.jsx("div",{className:d.editorGutter,children:Ve.code.split(`
`).map((c,g)=>s.jsx("span",{children:g+1},g))}),s.jsx("pre",{className:d.codeBlock,children:s.jsx("code",{dangerouslySetInnerHTML:{__html:Eu(Ve.code,Ve.language)}})})]}),s.jsxs("div",{className:d.editorStatusBar,children:[s.jsx("span",{children:Ve.language.toUpperCase()}),s.jsx("span",{children:"UTF-8"}),s.jsxs("span",{children:["Ln ",Ve.code.split(`
`).length]})]})]})]})]})]})]}),Zo&&s.jsx("div",{className:d.publishBackdrop,onClick:c=>{c.target===c.currentTarget&&(rt(""),wt(!1))},children:s.jsxs("div",{className:d.publishModal,children:[s.jsx("button",{className:d.publishClose,type:"button",onClick:()=>{rt(""),wt(!1)},"aria-label":"Close",children:s.jsxs("svg",{width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.5",strokeLinecap:"round",children:[s.jsx("line",{x1:"18",y1:"6",x2:"6",y2:"18"}),s.jsx("line",{x1:"6",y1:"6",x2:"18",y2:"18"})]})}),s.jsx("h2",{className:d.publishModalTitle,children:"Publish to Community"}),s.jsxs("p",{className:d.publishModalSubtitle,children:["Share ",s.jsx("strong",{children:m||"this project"})," with the OpenThorn community."]}),s.jsxs("label",{className:d.publishModalLabel,children:["Description ",s.jsx("span",{className:d.publishModalOptional,children:"(optional)"})]}),s.jsx("textarea",{className:d.publishModalTextarea,placeholder:"What did you build? Add a short description…",value:Ht,onChange:c=>qt(c.target.value),rows:3,maxLength:280}),En&&s.jsx("p",{className:d.publishModalError,children:En}),s.jsx("button",{className:d.publishModalBtn,type:"button",onClick:hs,disabled:_t,children:_t?"Publishing…":"Publish →"})]})}),Qo&&s.jsxs("div",{className:d.publishSuccessToast,children:[s.jsx("svg",{width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.5",strokeLinecap:"round",strokeLinejoin:"round",children:s.jsx("polyline",{points:"20 6 9 17 4 12"})}),"Published to Community"]})]})}function ko(){return s.jsxs("svg",{width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[s.jsx("path",{d:"M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"}),s.jsx("path",{d:"M15 3h6v6"}),s.jsx("path",{d:"M10 14L21 3"})]})}function Lu(){return s.jsx("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:s.jsx("path",{d:"M20 6L9 17l-5-5"})})}function Mu({markdown:e}){return e!=null&&e.trim()?s.jsx("div",{className:d.markdown,children:s.jsx(Ys,{remarkPlugins:[Xs],components:{a:({href:t,children:o,...n})=>s.jsx("a",{href:t,target:"_blank",rel:"noopener noreferrer",...n,children:o}),table:({children:t,...o})=>s.jsx("div",{className:d.tableWrapper,children:s.jsx("table",{...o,children:t})})},children:e})}):null}function Pu({thought:e,collapsed:t,onToggle:o}){return e?s.jsxs("div",{className:`${d.thinkingBlock} ${t?d.thinkingBlockCollapsed:""}`,children:[s.jsxs("button",{type:"button",className:d.thinkingToggle,onClick:o,children:[s.jsx("span",{className:d.thinkingIcon,children:s.jsx(zo,{expanded:!t})}),s.jsx("span",{className:d.thinkingLabel,children:t?"Thinking — tap to expand":"Thinking"})]}),!t&&s.jsx("div",{className:d.thinkingContent,children:s.jsx("div",{className:d.thinkingThought,children:e.split(`
`).map((n,i)=>s.jsx("p",{children:n},i))})})]}):null}function $u(){return s.jsxs("svg",{width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",children:[s.jsx("circle",{cx:"12",cy:"12",r:"10"}),s.jsx("path",{d:"M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20"})]})}function Ou(){return s.jsx("svg",{width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",children:s.jsx("path",{d:"M16 18l6-6-6-6M8 6l-6 6 6 6"})})}function Du(){return s.jsxs("svg",{width:"17",height:"17",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round",children:[s.jsx("path",{d:"M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z"}),s.jsx("path",{d:"M12 11v5M9 14l3 3 3-3"})]})}function Bu(){return s.jsxs("svg",{width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.9",strokeLinecap:"round",strokeLinejoin:"round",children:[s.jsx("path",{d:"M16 6l-8 4.5M8 13.5l8 4.5"}),s.jsx("circle",{cx:"18",cy:"5",r:"3"}),s.jsx("circle",{cx:"6",cy:"12",r:"3"}),s.jsx("circle",{cx:"18",cy:"19",r:"3"})]})}function hn(){return s.jsx("svg",{width:"17",height:"17",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.1",strokeLinecap:"round",children:s.jsx("path",{d:"M18 6L6 18M6 6l12 12"})})}function Fu(){return s.jsxs("svg",{width:"17",height:"17",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round",children:[s.jsx("path",{d:"M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z"}),s.jsx("path",{d:"M22 6l-10 7L2 6"})]})}function Uu(){return s.jsxs("svg",{width:"17",height:"17",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.9",strokeLinecap:"round",strokeLinejoin:"round",children:[s.jsx("path",{d:"M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"}),s.jsx("path",{d:"M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"})]})}function Wu(){return s.jsxs("svg",{width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.9",strokeLinecap:"round",strokeLinejoin:"round",children:[s.jsx("path",{d:"M3 6h18"}),s.jsx("path",{d:"M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"}),s.jsx("path",{d:"M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"}),s.jsx("path",{d:"M10 11v6M14 11v6"})]})}function Hu(){return s.jsxs("svg",{width:"17",height:"17",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.8",children:[s.jsx("rect",{x:"3",y:"4",width:"18",height:"12",rx:"2"}),s.jsx("path",{d:"M8 20h8M12 16v4"})]})}function xo(){return s.jsxs("svg",{width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.8",children:[s.jsx("path",{d:"M21 12a9 9 0 11-2.64-6.36"}),s.jsx("path",{d:"M21 3v6h-6"})]})}function qu(){return s.jsx("svg",{width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",children:s.jsx("path",{d:"M6 9l6 6 6-6"})})}function ut(){return s.jsx("svg",{width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",children:s.jsx("path",{d:"M20 6L9 17l-5-5"})})}function Gu(){return s.jsxs("svg",{width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",children:[s.jsx("circle",{cx:"12",cy:"12",r:"9"}),s.jsx("path",{d:"M12 7v5l3 2"})]})}function zu(){return s.jsxs("svg",{width:"17",height:"17",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.8",children:[s.jsx("rect",{x:"5",y:"2",width:"14",height:"20",rx:"2"}),s.jsx("path",{d:"M11 18h2"})]})}function Vu(){return s.jsxs("svg",{width:"17",height:"17",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.8",children:[s.jsx("rect",{x:"7",y:"2",width:"10",height:"20",rx:"2"}),s.jsx("path",{d:"M11 18h2"})]})}function Ku(){return s.jsx("svg",{width:"17",height:"17",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.8",children:s.jsx("path",{d:"M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5"})})}function Ju(){return s.jsx("svg",{width:"17",height:"17",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.8",children:s.jsx("path",{d:"M8 3v5H3M16 3v5h5M8 21v-5H3M21 16h-5v5"})})}function jo(){return s.jsxs("svg",{width:"17",height:"17",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.7",strokeLinecap:"round",strokeLinejoin:"round",children:[s.jsx("path",{d:"M5 3.5l6.4 15.3 2-6.1 6.1-2L5 3.5z",fill:"currentColor",fillOpacity:"0.14"}),s.jsx("path",{d:"M18.5 3v3M17 4.5h3"})]})}function Yu({open:e}){return s.jsx("svg",{width:"16",height:"16",viewBox:"0 0 16 16",fill:"none",stroke:"currentColor",strokeWidth:"0.9",children:e?s.jsx("path",{d:"M12.5 12.5a1 1 0 001-1V5.5a1 1 0 00-1-1H7.7L6.5 3.5H3.5a1 1 0 00-1 1v8a1 1 0 001 1h9z"}):s.jsx("path",{d:"M12.5 12.5a1 1 0 001-1V5.5a1 1 0 00-1-1H7.7L6.5 3.5H3.5a1 1 0 00-1 1v8a1 1 0 001 1h9z"})})}function Go(){return s.jsxs("svg",{width:"14",height:"14",viewBox:"0 0 16 16",fill:"none",stroke:"currentColor",strokeWidth:"0.9",children:[s.jsx("path",{d:"M4.5 1.5h5.5l3.5 3.5v9.5a1 1 0 01-1 1h-8a1 1 0 01-1-1v-12a1 1 0 011-1z"}),s.jsx("path",{d:"M10 1.5v3.5h3.5"})]})}function zo({expanded:e}){return s.jsx("svg",{width:"10",height:"10",viewBox:"0 0 10 10",fill:"none",style:{transform:e?"rotate(90deg)":void 0,transition:"transform 0.12s ease"},children:s.jsx("path",{d:"M3.5 2L6.5 5L3.5 8",stroke:"currentColor",strokeWidth:"1",strokeLinecap:"round",strokeLinejoin:"round"})})}function Vo({node:e,depth:t,activeFile:o,expandedFolders:n,onSelectFile:i,onToggleFolder:r}){const l=n.has(e.path),h=t*16;return e.type==="folder"?s.jsxs("div",{children:[s.jsxs("button",{className:d.treeNode,style:{paddingLeft:8+h},type:"button",onClick:()=>r(e.path),children:[s.jsx("span",{className:d.treeGuides,children:Array.from({length:t},(a,m)=>s.jsx("span",{className:d.treeGuide,style:{left:8+m*16+5}},m))}),s.jsx("span",{className:d.treeChevron,children:s.jsx(zo,{expanded:l})}),s.jsx("span",{className:d.treeIcon,children:s.jsx(Yu,{open:l})}),s.jsx("span",{className:d.treeName,children:e.name})]}),l&&e.children.map(a=>s.jsx(Vo,{node:a,depth:t+1,activeFile:o,expandedFolders:n,onSelectFile:i,onToggleFolder:r},a.path))]}):s.jsxs("button",{className:`${d.treeNode} ${d.treeFile} ${e.path===o?d.treeFileActive:""}`,style:{paddingLeft:8+h},type:"button",onClick:()=>i(e.path),children:[s.jsx("span",{className:d.treeGuides,children:Array.from({length:t},(a,m)=>s.jsx("span",{className:d.treeGuide,style:{left:8+m*16+5}},m))}),s.jsx("span",{className:d.treeChevron}),s.jsx("span",{className:d.treeIcon,children:s.jsx(Go,{})}),s.jsx("span",{className:d.treeName,children:e.name})]})}export{rp as default};
