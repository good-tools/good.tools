// Serves branch previews on good.tools subdomains: pr-<n>.good.tools proxies to the `pr-<n>`
// preview alias of the good-tools Worker (Cloudflare only serves preview URLs on workers.dev).
// Also redirects www.good.tools to the apex. api.good.tools is DNS-only, so it never gets here.
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const sub = url.hostname.split('.')[0]
    if (sub === 'www') return Response.redirect(`https://good.tools${url.pathname}${url.search}`, 301)
    if (!/^pr-\d+$/.test(sub)) return new Response('Not found', { status: 404 })
    url.hostname = `${sub}-${env.PREVIEW_HOST}`
    return fetch(new Request(url, request), { redirect: 'manual' })
  },
}
