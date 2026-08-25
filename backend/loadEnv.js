// loadEnv.js — minimal, dependency-free .env loader for the backend.
// Reads ../.env.local (git-ignored) and injects any keys not already present
// in process.env, so `node server.js` picks up OPENAI_API_KEY etc. without a
// shell `export` or an external `dotenv` dependency.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  path.resolve(here, '..', '.env.local'),
  path.resolve(here, '..', '..', '.env'),
];

for (const envPath of candidates) {
  if (!fs.existsSync(envPath)) continue;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  break; // only load the first env file found
}
