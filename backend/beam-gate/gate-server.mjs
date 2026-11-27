// SmartVidDownloader gate, standalone: only the sign-in check and the proxy, so it can run as its own small service on Beam.
// The code that does the work is the host app's own (../services/vidbeeProxy.js, ../middleware/auth.js), copied in by the Dockerfile.
//   POST /api/vidbee/session  checks the person's sign-in (Supabase) and the allowlist, then sets a short-lived cookie
//   ANY  /vidbee/*            needs that cookie, then streams to the downloader pod, adding the shared secret
import express from 'express';
import cors from 'cors';
import { installVidBee } from './services/vidbeeProxy.js';
import { auth } from './middleware/auth.js';

const app = express();
// No `trust proxy`: the gate reads x-forwarded-proto itself to mark the cookie Secure, and nothing else here needs the client address.
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
installVidBee(app, { auth, cors: cors() });

const port = Number(process.env.PORT || 8080);
app.listen(port, '0.0.0.0', () => console.log(`[vidbee gate] listening on :${port}`));
