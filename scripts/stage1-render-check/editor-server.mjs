// Shared by the editor checks: a throwaway Vite dev server (configFile:false, the app's vite.config.js is not used) that serves
// editor.html with the REAL provider/editor, stubbing only app-shell glue (router, auth keys, social publish, cross-studio handoff).
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../..')
const stub = (n) => path.join(here, 'stubs', n)
export async function startEditorServer(port = 5198, root = here) {
  const server = await createServer({
    configFile: false, root, logLevel: 'error', plugins: [react()],
    define: { 'process.browser': 'true', 'process.env': '{}' },
    resolve: {
      dedupe: ['react', 'react-dom', 'remotion'],
      alias: [
        { find: /^@ohb\/lib\/navigation$/, replacement: stub('navigation.ts') },
        { find: /^@ohb\/components\/SocialPublishProvider$/, replacement: stub('SocialPublishProvider.ts') },
        { find: /^@ohb\/shared\/crossStudio$/, replacement: stub('crossStudio.ts') },
        { find: /^@ohb/, replacement: path.join(repo, 'src/features/personalization') },
        { find: /^@\//, replacement: repo + '/' },
      ],
    },
    server: { port, fs: { strict: false } },
    optimizeDeps: { noDiscovery: true, force: true, include: ['react', 'react-dom', 'react-dom/client', 'react-konva', 'konva', 'react-reconciler/constants', 'react-easy-crop'], exclude: ['remotion', '@remotion/web-renderer', '@remotion/media'] },
  })
  await server.listen()
  return server
}
