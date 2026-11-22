# muapi-studio (vendored build)

Prebuilt output of the standalone `muapi-studio` package (`npm run build` in that repo), copied here so
Netlify can install it with `"muapi-studio": "file:vendor/muapi-studio"`. Do not edit these files by hand:
rebuild the package and copy `dist/muapi-studio.js` to `index.js` and `dist/style.css` to `style.css`.

Mounted by `src/components/MuapiStudioPage.js`, which talks to MuAPI through the app's own Supabase
`muapi-proxy` via `src/lib/muapiStudioTransport.js` (the user's own key, never a shared one).
