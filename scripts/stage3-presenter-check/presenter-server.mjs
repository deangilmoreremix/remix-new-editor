// Throwaway Vite dev server for the Stage 3 checks. Same shape as stage1-render-check/editor-server.mjs, plus the
// repo's public/ folder (the MediaPipe model at /mediapipe/ and the sample presenter video under /media/).
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../..')
const stub = (n) => path.join(repo, 'scripts/stage1-render-check/stubs', n)
export async function startPresenterServer(port = 5203, root = here) {
  const server = await createServer({
    configFile: false, root, logLevel: 'error', plugins: [react()], publicDir: path.join(repo, 'public'),
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
    optimizeDeps: { noDiscovery: true, force: true, include: ['react', 'react-dom', 'react-dom/client', 'react-konva', 'konva', 'react-reconciler/constants', 'react-easy-crop', '@mediapipe/tasks-vision', 'react-dom/server', '@react-email/render'], exclude: ['remotion', '@remotion/web-renderer', '@remotion/media'] },
  })
  await server.listen()
  return server
}
