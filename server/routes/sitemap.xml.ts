const PAGES = [
  { path: '/', priority: '1.0' },
  { path: '/guide', priority: '0.8' },
]

export default defineEventHandler((event) => {
  const origin = getRequestURL(event).origin
  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  const urls = PAGES.map(p => `  <url><loc>${origin}${p.path}</loc><priority>${p.priority}</priority></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
})
