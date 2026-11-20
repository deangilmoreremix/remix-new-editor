# Collab Suite

Standalone Teamchat and Meetings, independent of SmartVideo (no imports from it; move this folder to its own repo as-is).

| App | Source | Status |
|---|---|---|
| Teamchat | upstream `HeyPuter/everything` (vendored, unmodified) | Real app; needs a Puter account |
| Meetings | upstream `HeyPuter/everything` (vendored, unmodified) | Real app; needs a Puter account |

Teamchat and Meetings are upstream's own code in `vendor/everything/` (see `VENDORED.md` there for the source,
commit and license). The shell only embeds their built output; the one piece of glue is `Embed` in
`apps/shell/src/main.tsx` and the `build:*` scripts in `package.json`.

```
npm install
npm run setup          # npm ci inside each vendored app
npm run dev            # builds the vendored apps into the shell, then serves it on :3200
npm run build
npm run typecheck
```

Both apps load Puter.js from `js.puter.com` at runtime, so people using them need a Puter account and the host must
be able to reach that CDN. Teamchat also ships a backend-free demo (`mock.html`, one browser only) that runs under its
own dev server: `cd vendor/everything/src/teamchat && npm run dev`, then open `/mock.html?as=alice`.
