# Content Security Policy Notes

**Last updated:** 2026-08-27

The CSP is configured in `vercel.json` and deployed with the app. Current policy:

- `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'` — `unsafe-inline` is required for some inline scripts; `wasm-unsafe-eval` is required for the in-browser esbuild-wasm bundler
- `style-src 'self' 'unsafe-inline'` — required for dynamic inline styles (component state, chart positioning, CSS variables)
- `img-src 'self' data: blob: https:` — allows loading remote images (user-provided URLs)
- `connect-src 'self' https: wss:` — allows API calls to AI providers
- `frame-src 'self' blob: data: https://www.youtube-nocookie.com` — allows embedded YouTube videos

## Hardening roadmap

1. Move inline scripts to external files to remove `unsafe-inline` from `script-src`
2. Migrate dynamic styles to CSS classes to remove `unsafe-inline` from `style-src`
3. Add nonce-based CSP for scripts once inline scripts are eliminated
