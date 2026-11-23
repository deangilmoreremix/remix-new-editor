# muapi-studio (vendored build)

Prebuilt output of the standalone `muapi-studio` package (`npm run build` in that repo), copied here so
Netlify can install it with `"muapi-studio": "file:vendor/muapi-studio"`. Do not edit these files by hand:
rebuild the package and copy `dist/muapi-studio.js` to `index.js`, `dist/style.css` to `style.css`, and
the hashed 3D-viewer chunk `dist/model-viewer-*.js` next to them. `index.js` imports that chunk by its exact file name,
so if a rebuild changes the hash, copy the new file and delete the old one.

Mounted by `src/components/MuapiStudioPage.js`, which talks to MuAPI through the app's own Supabase
`muapi-proxy` via `src/lib/muapiStudioTransport.js` (the user's own key, never a shared one).

Exception to the proxy rule: uploads larger than the transport's size limit are sent straight to MuAPI's
`upload_file` endpoint with the user's own key, because the edge proxy cannot carry large bodies. Every other
Studio request goes through `muapi-proxy`.
