// Starts the dev server on port 3100 with the minimum config needed to render the app shell without real credentials, so UI checks
// (Playwright, tooltip coverage audit, screenshots) can run on a clean machine:  npm run dev:ui-check
//
// Without these the shell stays blank: Supabase's client throws when its URL/key are unset, and the sign-in gate blocks the router.
// Every value is a non-secret placeholder. Nothing here talks to a real backend; generation calls fail, which is fine for UI checks.
// Open pages as  http://127.0.0.1:3100/?dev#/<route>  (the ?dev flag also enables the auth bypass at runtime).
// Anything already set in your environment or .env wins, so a real setup is never overridden.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Same path `npm run build` uses; vite's package "exports" does not expose bin/vite.js to require.resolve.
const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));

const env = {
  VITE_DEV_BYPASS_AUTH: 'true',
  VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
  VITE_SUPABASE_ANON_KEY: 'dummy-anon-key-for-local-ui-check',
  ...process.env,
};

const child = spawn(process.execPath, [viteBin, '--port', '3100', '--host', '127.0.0.1', ...process.argv.slice(2)], { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
