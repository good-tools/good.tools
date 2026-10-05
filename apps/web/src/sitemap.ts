// Writes public/sitemap.xml from the tool registry. Run with: bun src/sitemap.ts
import { writeFileSync } from 'node:fs'
import { tools } from '@/config/tools.config'

const hostname = process.env.SITEMAP_HOSTNAME || 'https://good.tools'
const urls = [
  `  <url><loc>${hostname}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
  ...tools.map(
    (t) => `  <url><loc>${hostname}${t.path}</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>`,
  ),
]
writeFileSync(
  'public/sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
)
