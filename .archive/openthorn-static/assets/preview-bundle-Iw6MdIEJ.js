import{g as S}from"./vendor-react-OCkIFBX-.js";import{r as j}from"./vendor-esbuild-BtTWknlI.js";function L(e,s){for(var t=0;t<s.length;t++){const r=s[t];if(typeof r!="string"&&!Array.isArray(r)){for(const n in r)if(n!=="default"&&!(n in e)){const a=Object.getOwnPropertyDescriptor(r,n);a&&Object.defineProperty(e,n,a.get?a:{enumerable:!0,get:()=>r[n]})}}}return Object.freeze(Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}))}var v=j();const N=S(v),_=L({__proto__:null,default:N},[v]);let d=null;function A(){return d||(d=v.initialize({worker:!1,wasmURL:"https://unpkg.com/esbuild-wasm@0.28.0/esbuild.wasm"})),d}const O=["",".tsx",".ts",".jsx",".js",".css"];function $(e){return e.endsWith(".tsx")?"tsx":e.endsWith(".ts")?"ts":e.endsWith(".jsx")?"jsx":e.endsWith(".css")?"css":e.endsWith(".json")?"json":"js"}function f(e){const s=e.indexOf(":");if(s===-1||e[s+1]==="/"&&e[s+2]==="/")return e;const t=e.indexOf("/");return t===-1||s<t?e.substring(s+1):e}function W(e){const s=e.split("/"),t=[];for(const r of s)r===".."?t.pop():r!=="."&&r!==""&&t.push(r);return"/"+t.join("/")}function H(e,s="/src"){const t={};for(const[r,n]of Object.entries(e))t[r]=n,r.startsWith("/")?t[r.slice(1)]=n:t["/"+r]=n;return{name:"virtual-fs",setup(r){r.onResolve({filter:/.*/},n=>{if(n.path.startsWith("https://")||n.path.startsWith("http://"))return{path:n.path,external:!0};let a=f(n.path);if(n.path.startsWith(".")){const o=f(n.importer||""),i=o?o.replace(/\/[^/]*$/,""):s;a=W(`${i}/${n.path}`)}else if(!a.startsWith("/"))return{path:a,external:!0};for(const o of O){const i=a+o;if(t[i]!==void 0)return{path:i,namespace:"virtual"}}for(const o of[".tsx",".ts",".jsx",".js"]){const i=a.replace(/\/$/,"")+"/index"+o;if(t[i]!==void 0)return{path:i,namespace:"virtual"}}if(n.path.startsWith(".")||n.path.startsWith("/"))return{errors:[{text:`Could not resolve "${n.path}"`,location:{file:n.importer||a}}]}}),r.onLoad({filter:/.*/,namespace:"virtual"},n=>{const a=f(n.path),o=t[a];return o===void 0?{errors:[{text:`File not found: ${a}`,location:{line:0,column:0,file:a}}]}:{contents:o,loader:$(a),resolveDir:a.substring(0,a.lastIndexOf("/"))}})}}}const T=`/**
 * OpenThorn Hash Router — minimal react-router-dom v6 replacement.
 *
 * Uses window.location.hash + hashchange event. Zero dependencies,
 * no URL constructor, no history library. Works everywhere:
 * srcdoc iframes, sandboxed contexts, static deployments, GitHub Pages.
 *
 * Exports the same API as react-router-dom:
 *   HashRouter, Routes, Route, Link, NavLink,
 *   useNavigate, useParams, useLocation, Outlet
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo, createElement, Children } from 'react'

// ─── Context ────────────────────────────────────────────────────────────────

const RouterContext = createContext(null)

// ─── Helpers ────────────────────────────────────────────────────────────────

function getHashPath() {
  const hash = window.location.hash || '#/'
  // Remove leading # and optional /
  let path = hash.slice(1) || '/'
  if (!path.startsWith('/')) path = '/' + path
  // Remove trailing slash (except root)
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  return path
}

function matchRoute(pattern, path) {
  if (pattern === '*' || pattern === '/*') return { matches: true, params: {} }
  if (pattern === path) return { matches: true, params: {} }
  if (pattern === '/' && path === '') return { matches: true, params: {} }

  const patternParts = pattern.split('/').filter(Boolean)
  const pathParts = path.split('/').filter(Boolean)

  if (patternParts.length === 0 && pathParts.length === 0) return { matches: true, params: {} }

  // Check if lengths match (unless pattern has splat)
  const hasSplat = patternParts[patternParts.length - 1] === '*'
  if (!hasSplat && patternParts.length !== pathParts.length) return { matches: false, params: {} }

  const params = {}
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i]
    const pt = pathParts[i]

    if (pp === '*') return { matches: true, params }

    if (pp.startsWith(':')) {
      params[pp.slice(1)] = pt || ''
      continue
    }

    if (pp !== pt) return { matches: false, params: {} }
  }

  return { matches: true, params }
}

// ─── HashRouter ─────────────────────────────────────────────────────────────

export function HashRouter({ children }) {
  const [path, setPath] = useState(getHashPath)
  const [params, setParams] = useState({})
  const [outletContext, setOutletContext] = useState(null)

  useEffect(() => {
    const handler = () => setPath(getHashPath())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  const navigate = useCallback((to) => {
    if (typeof to === 'string') {
      window.location.hash = to.startsWith('#') ? to : '#' + (to.startsWith('/') ? to : '/' + to)
    } else if (typeof to === 'number') {
      window.history.go(to)
    }
  }, [])

  const value = useMemo(() => ({ path, params, setParams, outletContext, setOutletContext, navigate }), [path, params, outletContext, navigate])

  return createElement(RouterContext.Provider, { value }, children)
}

// ─── useRouter ──────────────────────────────────────────────────────────────

function useRouter() {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('Router components must be used inside <HashRouter>')
  return ctx
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export function Routes({ children }) {
  const { path, setParams } = useRouter()
  const childrenArr = Children.toArray(children)

  for (const child of childrenArr) {
    if (!child || !child.props) continue
    const pattern = child.props.path || '/'
    const result = matchRoute(pattern, path)
    if (result.matches) {
      // Clone element with route params
      const element = child.props.element
      return element || child
    }
  }

  return null
}

// ─── Route ──────────────────────────────────────────────────────────────────

export function Route({ path, element }) {
  // Route is only rendered via Routes
  return element || null
}

// ─── Link ───────────────────────────────────────────────────────────────────

export function Link({ to, children, className, style, ...props }) {
  const { navigate } = useRouter()

  const href = to.startsWith('#') ? to : '#' + (to.startsWith('/') ? to : '/' + to)

  const handleClick = useCallback((e) => {
    e.preventDefault()
    navigate(to)
  }, [to, navigate])

  return createElement('a', { ...props, href, onClick: handleClick, className, style }, children)
}

// ─── NavLink ────────────────────────────────────────────────────────────────

export function NavLink({ to, children, className, style, activeClassName, activeStyle, ...props }) {
  const { path } = useRouter()
  const targetPath = to.startsWith('/') ? to : '/' + to
  const isActive = path === targetPath || (targetPath !== '/' && path.startsWith(targetPath))

  // Support className as function (like react-router-dom v6)
  let resolvedClassName = className
  if (typeof className === 'function') {
    resolvedClassName = className({ isActive })
  } else if (isActive && activeClassName) {
    resolvedClassName = (className || '') + ' ' + activeClassName
  }

  const resolvedStyle = isActive && activeStyle ? { ...style, ...activeStyle } : style

  const { navigate } = useRouter()
  const href = to.startsWith('#') ? to : '#' + (to.startsWith('/') ? to : '/' + to)

  const handleClick = useCallback((e) => {
    e.preventDefault()
    navigate(to)
  }, [to, navigate])

  return createElement('a', {
    ...props,
    href,
    onClick: handleClick,
    className: resolvedClassName,
    style: resolvedStyle,
    'aria-current': isActive ? 'page' : undefined,
  }, children)
}

// ─── useNavigate ────────────────────────────────────────────────────────────

export function useNavigate() {
  const { navigate } = useRouter()
  return navigate
}

// ─── useParams ──────────────────────────────────────────────────────────────

export function useParams() {
  const { path, params } = useRouter()
  // Extract params from the current path and the matched route
  // This is a simplified version — actual params come from the Route match
  return params || {}
}

// ─── useLocation ────────────────────────────────────────────────────────────

export function useLocation() {
  const { path } = useRouter()
  return { pathname: path, search: '', hash: window.location.hash, state: null, key: 'default' }
}

// ─── Outlet ─────────────────────────────────────────────────────────────────

export function Outlet() {
  const { outletContext } = useRouter()
  // Outlet is rendered by nested Routes — pass outletContext if set
  return outletContext || null
}

// ─── BrowserRouter (alias for HashRouter) ──────────────────────────────────

// Some projects import BrowserRouter — in srcdoc contexts it behaves
// identically to HashRouter since there's no server to handle paths.
export const BrowserRouter = HashRouter

// ─── Navigate (redirect component) ──────────────────────────────────────────

export function Navigate({ to, replace }) {
  const { navigate, setOutletContext } = useRouter()

  useEffect(() => {
    navigate(to)
    // Also propagate through outlet context for nested navigation
    if (setOutletContext) {
      setOutletContext({ to, replace })
    }
  }, [to, replace, navigate, setOutletContext])

  return null
}
`,D=`// OpenThorn dev jsx-runtime shim. Injected into instrumented previews via a
// data: URL so clicking a rendered element can be traced to its JSX source.
// Mirrors injectOeidProps in src/lib/preview-edit.ts — keep in sync.
import { jsxDEV as _jsxDEV, Fragment } from 'https://esm.sh/react@18.2.0/jsx-dev-runtime'

function oeid(source) {
  if (!source || !source.fileName) return ''
  var file = String(source.fileName).replace(/^virtual:/, '').replace(/^\\/+/, '')
  file = file.split('/').pop()
  return file + ':' + source.lineNumber + ':' + source.columnNumber
}

export function jsxDEV(type, props, key, isStaticChildren, source, self) {
  if (typeof type === 'string' && source) {
    var next = Object.assign({}, props)
    next['data-oeid'] = oeid(source)
    return _jsxDEV(type, next, key, isStaticChildren, source, self)
  }
  return _jsxDEV(type, props, key, isStaticChildren, source, self)
}

export { Fragment }
`,I=`// Injected data-layer client for generated apps. Resolves the project's Supabase
// config from a global set by the preview/deploy HTML, so generated code never
// hardcodes keys or calls createClient itself.
//
// Usage in app code:
//   import { db, auth } from '@openthorn/db'
//   const { data } = await db.from('todos').select()
//   await auth.signInWithPassword({ email, password })
import { createClient } from '@supabase/supabase-js'

const cfg = (typeof window !== 'undefined' && window.__OPENTHORN_SUPABASE__) || {}

// Lock used by GoTrueClient to serialize token refreshes. supabase-js defaults to
// the Web Locks API (navigator.locks), but that API is DENIED in an opaque-origin
// context — which is exactly what the preview/runtime-check iframe is (sandboxed
// with allow-scripts but no allow-same-origin). The denied lock rejects during the
// client's async initialize(), surfacing as a fatal "LockManager" error that no app
// code can catch (navigator.locks is a non-configurable getter). We pass a lock that
// uses Web Locks when they actually work and otherwise just runs the callback
// directly — correct in the single-tab sandbox, and a safe (cross-tab coordination
// is best-effort) fallback in real deploys.
async function resilientLock(name, _acquireTimeout, fn) {
  try {
    const locks =
      typeof navigator !== 'undefined' && navigator.locks ? navigator.locks : null
    if (locks && typeof locks.request === 'function') {
      return await locks.request(name, { mode: 'exclusive' }, () => fn())
    }
  } catch {
    // navigator.locks denied (opaque-origin sandbox) — fall through to run directly.
  }
  return fn()
}

export const db = createClient(cfg.url || '', cfg.anonKey || '', {
  auth: { persistSession: true, autoRefreshToken: true, lock: resilientLock },
})

export const auth = db.auth
export default db
`,m="?external=react,react-dom",x=[{name:"framer-motion",url:`https://esm.sh/framer-motion@11.3.19${m}`,description:'Production animation library: `import { motion, AnimatePresence } from "framer-motion"`.'},{name:"lucide-react",url:`https://esm.sh/lucide-react@0.427.0${m}`,description:'Clean SVG icons: `import { Menu, ArrowRight, Check } from "lucide-react"`.'},{name:"recharts",url:`https://esm.sh/recharts@2.12.7${m}`,description:'Composable charts: `import { LineChart, Line, XAxis, Tooltip } from "recharts"`.'},{name:"clsx",url:"https://esm.sh/clsx@2.1.1",description:'Tiny className builder: `import clsx from "clsx"`.'},{name:"date-fns",url:"https://esm.sh/date-fns@3.6.0",description:'Date utilities: `import { format, addDays } from "date-fns"`.'},{name:"nanoid",url:"https://esm.sh/nanoid@5.0.7",description:'Unique id generator: `import { nanoid } from "nanoid"`.'},{name:"@supabase/supabase-js",url:"https://esm.sh/@supabase/supabase-js@2.45.4",description:"Supabase client (database + auth). Prefer the injected `@openthorn/db` over importing this directly."}],M=x.map(e=>e.name);[...M];const B="[Visual edit]";function te(e,s){const t=e.oeid?` at ${e.oeid.split(":").slice(0,2).join(":")}`:"",r=e.text?` (text: "${e.text.slice(0,80)}")`:"",n=Object.entries(e.styles).map(([o,i])=>`${o}: ${i}`).join("; "),a=n?` Current styles — ${n}.`:"";return`${B} The user selected the <${e.tag}> element${t}${r}.${a} Apply only this change to that element: ${s.trim()}`}function y(e){return e?e.split(":")[0].split("/").pop()??null:null}function ne(e,s){const t=y(e.oeid),r=t?` in ${t}`:"";return`Edit <${e.tag}>${r}: ${s.trim()}`}function re(e,s){const t=y(s);if(!t)return null;const r=e.filter(n=>n===t||n.endsWith("/"+t));return r.length===1?r[0]:null}function se(e,s,t){const r=s.trim();if(!r)return null;const n=e.split(r);if(n.length===2)return n.join(t);const a=r.replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/\s+/g,"\\s+"),o=new RegExp(a,"g"),i=e.match(o);return!i||i.length!==1?null:e.replace(o,()=>t)}const l=8;function ae(e,s,t){const r=e.top+e.height+l,n=e.top-s.height-l,o=r+s.height<=t.height-l?r:n>=l?n:r,i=Math.max(l,t.height-s.height-l),p=Math.max(l,Math.min(o,i)),u=Math.max(l,t.width-s.width-l),h=Math.max(l,Math.min(e.left,u));return{top:p,left:h}}function U(){return`<script>
(function(){
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  var enabled = false, hl = null, label = null;

  function box(){
    if (hl) return;
    hl = document.createElement('div');
    hl.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;border:2px solid #6d28d9;background:rgba(109,40,217,0.08);border-radius:4px;transition:all .05s ease;';
    label = document.createElement('div');
    label.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;font:600 11px system-ui,sans-serif;color:#fff;background:#6d28d9;padding:2px 6px;border-radius:4px 4px 4px 0;transform:translateY(-100%);white-space:nowrap;';
    document.body.appendChild(hl); document.body.appendChild(label);
  }
  function clearBox(){ if (hl){ hl.remove(); label.remove(); hl=null; label=null; } }

  function nearestOeid(el){
    var n = el;
    while (n && n.nodeType === 1){ if (n.getAttribute && n.getAttribute('data-oeid')) return n; n = n.parentElement; }
    return null;
  }
  function move(e){
    if (!enabled) return;
    var el = e.target; if (!el || el.nodeType !== 1) return;
    var r = el.getBoundingClientRect();
    box();
    hl.style.top=r.top+'px'; hl.style.left=r.left+'px'; hl.style.width=r.width+'px'; hl.style.height=r.height+'px';
    label.style.top=r.top+'px'; label.style.left=r.left+'px';
    label.textContent = '<' + el.tagName.toLowerCase() + '>';
  }
  function pick(e){
    if (!enabled) return;
    e.preventDefault(); e.stopPropagation();
    var el = e.target; var holder = nearestOeid(el) || el;
    var cs = getComputedStyle(el); var r = el.getBoundingClientRect();
    var styles = {};
    ['color','backgroundColor','fontSize','fontWeight','margin','padding','display','textAlign'].forEach(function(k){ styles[k]=cs[k]; });
    var payload = {
      oeid: holder.getAttribute ? holder.getAttribute('data-oeid') : null,
      tag: el.tagName.toLowerCase(),
      text: (el.textContent||'').replace(/\\s+/g,' ').trim().slice(0,120),
      rect: { top:r.top, left:r.left, width:r.width, height:r.height },
      styles: styles
    };
    parent.postMessage({ __openthornEdit:'selected', payload: payload }, '*');
  }
  function enable(){ if (enabled) return; enabled=true; document.body.style.cursor='crosshair';
    document.addEventListener('mousemove', move, true); document.addEventListener('click', pick, true); }
  function disable(){ enabled=false; document.body.style.cursor=''; clearBox();
    document.removeEventListener('mousemove', move, true); document.removeEventListener('click', pick, true); }

  window.addEventListener('message', function(ev){
    var d = ev.data; if (!d || !d.__openthornEdit) return;
    if (d.__openthornEdit === 'enable') enable();
    else if (d.__openthornEdit === 'disable') disable();
  });
  // Esc inside the preview (where focus often lives) bubbles out to the parent.
  window.addEventListener('keydown', function(e){
    if (e.key === 'Escape') parent.postMessage({ __openthornEdit:'escape' }, '*');
  }, true);
  parent.postMessage({ __openthornEdit:'ready' }, '*');
})();
<\/script>`}const w="/src/main.tsx",F=`import { createRoot } from 'react-dom/client'
import App from './App'

const rootEl = document.getElementById('root')
if (rootEl) {
  createRoot(rootEl).render(<App />)
}
`;function z(e){const s={};for(const t of e)s[t.path.startsWith("/")?t.path:`/${t.path}`]=t.content;return s[w]=F,s}const b="18.2.0";function V(e=!1,s=!1){const t=`https://esm.sh/react@${b}`,r=`https://esm.sh/react-dom@${b}`,n="data:text/javascript;base64,"+g(T),a={react:t,"react-dom":r,"react-dom/client":`${r}/client`,"react/jsx-runtime":`${t}/jsx-runtime`,"react/jsx-dev-runtime":`${t}/jsx-dev-runtime`,"react-router-dom":n};for(const o of x)a[o.name]=o.url,a[`${o.name}/`]=o.url.split("?")[0]+"/";return e&&(a["react/jsx-dev-runtime"]="data:text/javascript;base64,"+g(D)),s&&(a["@openthorn/db"]="data:text/javascript;base64,"+g(I)),a}async function oe(e,s,t={}){const r=_;await A();const n=z(e);let a;try{a=await r.build({entryPoints:[`virtual:${w}`],bundle:!0,write:!1,outdir:"dist",format:"esm",target:"es2020",jsx:"automatic",jsxDev:t.instrument===!0,minify:!1,plugins:[H(n)]})}catch(c){return{html:"",errors:[c instanceof Error?c.message:String(c)]}}const o=(a.errors??[]).map(c=>c.text),i=(a.warnings??[]).map(c=>c.text);if(o.length>0)return{html:"",errors:[...o,...i.map(c=>`Warning: ${c}`)]};const p=a.outputFiles??[],u=p.find(c=>c.path.endsWith(".js")),h=p.find(c=>c.path.endsWith(".css")),k=((u==null?void 0:u.text)??"").replace(/<\/script>/gi,"<\\/script>"),C=h?`<style>
${h.text}
</style>`:"",E=JSON.stringify({imports:V(t.instrument,!!t.backend)},null,2),R=t.backend?`<script>window.__OPENTHORN_SUPABASE__=${JSON.stringify({url:t.backend.url,anonKey:t.backend.anonKey}).replace(/</g,"\\u003c")};<\/script>`:"",P=t.instrument?U():"";return{html:G(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script type="importmap">${E}<\/script>
  ${R}
  ${C}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; }
  </style>
  <script>
(function(){
  if (typeof window === 'undefined') return;

  // ── process.env stub ────────────────────────────────────────
  // Some esm.sh bundles (e.g. @supabase/supabase-js deps) reference process.env
  // at module load; without this they throw "process is not defined" in the iframe.
  if (typeof window.process === 'undefined') { window.process = { env: {} }; }

  // ── Storage polyfill ────────────────────────────────────────
  function makeStorage() {
    var s = {};
    return {
      getItem: function(k){ return k in s ? s[k] : null; },
      setItem: function(k,v){ s[k] = String(v); },
      removeItem: function(k){ delete s[k]; },
      clear: function(){ s = {}; },
      get length(){ return Object.keys(s).length; },
      key: function(i){ var ks = Object.keys(s); return ks[i] || null; }
    };
  }
  try { localStorage.getItem('__sbx_test__'); } catch(e) {
    Object.defineProperty(window, 'localStorage', { value: makeStorage(), configurable: true });
  }
  try { sessionStorage.getItem('__sbx_test__'); } catch(e) {
    Object.defineProperty(window, 'sessionStorage', { value: makeStorage(), configurable: true });
  }
})();
<\/script>
  <script>
(function(){
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function isModifiedClick(event) {
    return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
  }

  function isSpecialHref(href) {
    return /^(javascript:|mailto:|tel:|data:|blob:)/i.test(href);
  }

  function scrollToFragment(hash) {
    var id = decodeURIComponent(hash.slice(1));
    if (!id) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    var target = document.getElementById(id) || document.getElementsByName(id)[0];
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function toPreviewRoute(pathname, search, hash) {
    var path = pathname || '/';
    if (!path.startsWith('/')) path = '/' + path;
    return '#' + path + (search || '') + (hash || '');
  }

  document.addEventListener('click', function(event) {
    if (event.defaultPrevented || isModifiedClick(event)) return;

    var anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!anchor) return;

    var rawHref = (anchor.getAttribute('href') || '').trim();
    if (!rawHref || isSpecialHref(rawHref)) return;

    var target = (anchor.getAttribute('target') || '').toLowerCase();
    if (target && target !== '_self') return;

    var hasProtocol = /^[a-zA-Z][a-zA-Z\\d+\\-.]*:/.test(rawHref);
    var isRelative = !hasProtocol && !rawHref.startsWith('//');
    var isPreviewHashRoute = rawHref.startsWith('#/');
    var isPageFragment = rawHref.startsWith('#') && !isPreviewHashRoute;

    if (isPageFragment) {
      event.preventDefault();
      scrollToFragment(rawHref);
      return;
    }

    if (isPreviewHashRoute) {
      event.preventDefault();
      window.location.hash = rawHref.slice(1);
      return;
    }

    var url;
    try {
      url = new URL(rawHref, isRelative ? 'http://preview.local/' : window.location.href);
    } catch (error) {
      return;
    }

    var currentOrigin = new URL(window.location.href).origin;
    var isSameOrigin = url.origin === currentOrigin;
    var isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
    if (!isRelative && !isSameOrigin && !isLocalhost) return;

    event.preventDefault();
    window.location.hash = toPreviewRoute(url.pathname, url.search, url.hash).slice(1);
  }, true);
})();
<\/script>
  <script>
(function(){
  if (typeof document === 'undefined') return;
  document.addEventListener('submit', function(event){
    if (!event.defaultPrevented) event.preventDefault();
  }, true);
})();
<\/script>
  ${P}
</head>
<body>
  <div id="root"></div>
  <script type="module">
${k}
  <\/script>
</body>
</html>`),errors:[]}}function g(e){const s="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",t=new TextEncoder().encode(e);let r="";for(let n=0;n<t.length;n+=3){const a=t[n],o=n+1<t.length?t[n+1]:0,i=n+2<t.length?t[n+2]:0;r+=s[a>>2],r+=s[(a&3)<<4|o>>4],r+=n+1<t.length?s[(o&15)<<2|i>>6]:"=",r+=n+2<t.length?s[i&63]:"="}return r}function G(e){return e.replace(/<script[^>]*src=["']https?:\/\/localhost[^"']*["'][^>]*><\/script>/gi,"").replace(/<script[^>]*src=["']https?:\/\/127\.0\.0\.1[^"']*["'][^>]*><\/script>/gi,"").replace(/<script[^>]*>[^<]*\/@vite\/client[^<]*<\/script>/gi,"").replace(/<script[^>]*>[^<]*@react-refresh[^<]*<\/script>/gi,"").replace(/"https?:\/\/localhost[^"]*"/gi,'""').replace(/"https?:\/\/127\.0\.0\.1[^"]*"/gi,'""')}function ie(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}export{x as A,ae as a,se as b,oe as c,te as d,ie as e,ne as f,re as r};
