// Dev-only Vite config: the normal config plus a local stand-in for the Supabase muapi-proxy.
// See scripts/dev-muapi-proxy.mjs. Run with:  npx vite --config vite.devproxy.config.mjs
import { mergeConfig } from 'vite';
import baseConfig from './vite.config.js';
import { muapiDevProxyPlugin } from './scripts/dev-muapi-proxy.mjs';

export default mergeConfig(baseConfig, { plugins: [muapiDevProxyPlugin()] });
