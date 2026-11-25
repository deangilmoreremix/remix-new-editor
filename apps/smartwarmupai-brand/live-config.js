// Runtime settings that take the SmartWarmupAI dashboard off recorded demo data and onto the real backend, with one login:
// the person's SmartVideo (Clerk) session. Copied to public/smartwarmupai-app/config.js by `npm run build:smartwarmupai-app`.
// To go back to demo data, delete the copy step in package.json (or this file's contents): the dashboard falls back to demo.
window.__WARMBLY_ENV__ = { DEMO: "0", HOST_SESSION: "1", API_URL: "https://smartvid.app/smartwarmupai-api", APP_URL: "https://smartvid.app" };
