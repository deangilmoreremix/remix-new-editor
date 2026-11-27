# SmartVidDownloader gate on Beam

The downloader pod (`smartvid-downloader`, the upstream VidBee web app) refuses every request that does not carry a shared secret, so the
browser never talks to it directly. This small service is the only thing that does: it checks the person's sign-in against Supabase and the
allowlist, hands out an 8-hour cookie, and forwards `/vidbee/*` to the pod with the secret added. The code is the host app's own
(`backend/services/vidbeeProxy.js`, `backend/middleware/auth.js`); `gate-server.mjs` just runs it on its own.

## Deploy
```bash
beam deploy backend/beam-gate/app.py:pod        # from the repository root
```
Secrets (Beam, all required before deploying): `VIDBEE_GATE_TOKEN` (**the same value the downloader pod was started with**),
`VIDBEE_SESSION_SECRET`, `VIDBEE_WEB_URL` (the pod's address, `https://<pod stub id>-3000.app.beam.cloud`; update it and redeploy the gate whenever
the pod is redeployed), `VIDBEE_ALLOWED_USERS` (comma-separated user ids or emails; empty or unset means nobody), `SUPABASE_URL`,
`SUPABASE_ANON_KEY` (the public key the web app already ships).

## Route it from the site
Netlify forwards `/api/vidbee/*` and `/vidbee/*` to this service's address (a rule in `public/_redirects`), so the cookie stays first-party.
Each `beam deploy` of this service changes its address; update that rule.

## Private libraries
The pod and the gate both run with `VIDBEE_PER_USER=1`: each signed-in person gets their own downloads, history and settings (under `/data/users`
on the `smartvid-data` disk), and the gate tells the pod who is asking. Anything downloaded before this mode was switched on stays on the disk
but is not shown to anyone.

## Known limits
Netlify's proxy cuts a request at about 26 seconds. Normal use (adding links, the queue, transcripts) is unaffected, but burning subtitles into
a video (`/vidbee/export/video`) answers only when the encoding finishes, so a long one fails through the site, and retrying starts it again.
Fixing that needs a submit-and-poll flow in the downloader; it is not done here.

## Check it
`GET /health` returns `{"status":"ok"}`. Without a valid cookie `/vidbee/` answers 401 "Open SmartVidDownloader from the app…". A 401 reading
"Open this app from the host app." is the **pod** refusing the gate, which means the pod and the gate hold different `VIDBEE_GATE_TOKEN` values.
