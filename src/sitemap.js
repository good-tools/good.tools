const { createWriteStream } = require('fs');
const { SitemapStream } = require('sitemap');
const { urls } = require('./urls')
const hostname = process.env.SITEMAP_HOSTNAME || 'https://good.tools';

const sitemap = new SitemapStream({ hostname: hostname });

const writeStream = createWriteStream('./public/sitemap.xml');
sitemap.pipe(writeStream);

sitemap.write({ url: '/', changefreq: 'daily', priority: 1 });
Object.keys(urls).forEach(k => {
  sitemap.write({ url: urls[k], changefreq: 'monthly', priority: 0.8 });
})

sitemap.end();