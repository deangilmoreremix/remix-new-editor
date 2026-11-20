import type { MetadataRoute } from 'next';

// Static export writes this to out/robots.txt at build time.
export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Machine-readable mirrors of pages that already exist as HTML; indexing
      // both sides is duplicate content.
      disallow: ['/llms.mdx/', '/og/'],
    },
    sitemap: `${process.env.DOCS_SITE_URL || 'https://docs.warmbly.com'}${process.env.DOCS_BASE_PATH || ''}/sitemap.xml`,
  };
}
