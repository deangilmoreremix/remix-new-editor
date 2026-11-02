import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = fileURLToPath(new URL(".", import.meta.url));
const shim = (f: string) => path.join(root, "src/shims", f);

/** The template imports skill guides as `import x from "./3d.md"` (Next raw-loader). */
const markdownAsString = (): Plugin => ({
  name: "markdown-as-string",
  enforce: "pre",
  load(id) {
    if (!id.endsWith(".md")) return null;
    return `export default ${JSON.stringify(readFileSync(id, "utf8"))};`;
  },
});

// SmartVid port of Remotion's prompt-to-motion-graphics (Next.js) as a Vite SPA served
// from /motion-agent/ and embedded by src/components/studios/VideoAgentStudio. The few
// Next.js APIs the template uses are shimmed (src/shims), so upstream files stay intact.
export default defineConfig({
  plugins: [markdownAsString(), react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^next\/link$/, replacement: shim("next-link.tsx") },
      { find: /^next\/navigation$/, replacement: shim("next-navigation.ts") },
      { find: /^next\/dynamic$/, replacement: shim("next-dynamic.tsx") },
      { find: /^next$/, replacement: shim("next.ts") },
      { find: /^@\//, replacement: path.join(root, "src") + "/" },
    ],
  },
  server: { port: 5197, strictPort: true },
  build: { chunkSizeWarningLimit: 4000 },
});
