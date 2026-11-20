import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  // `next build` writes the whole site to `out/`, servable from any static host.
  output: 'export',
  // Served from a sub-path when hosted inside another site (DOCS_BASE_PATH=/warmbly-docs); unset = site root.
  basePath: process.env.DOCS_BASE_PATH || undefined,
  env: { NEXT_PUBLIC_DOCS_BASE_PATH: process.env.DOCS_BASE_PATH || '' },
  // Pages export as `<path>/index.html` so URLs resolve on any static server.
  trailingSlash: true,
  reactStrictMode: true,
  // Static export has no image optimizer; fumadocs maps MDX `img` to next/image.
  images: { unoptimized: true },
  // This app has its own lockfile alongside the repo root one; pin the workspace
  // root to silence Next's "multiple lockfiles" inference warning.
  turbopack: { root: import.meta.dirname },
};

export default withMDX(config);
