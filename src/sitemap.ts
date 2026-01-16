import { createWriteStream } from "fs";
import { SitemapStream } from "sitemap";
import { ROUTES } from "./config/routes.config";

const hostname = process.env.SITEMAP_HOSTNAME || "https://good.tools";

const sitemap = new SitemapStream({ hostname: hostname });

const writeStream = createWriteStream("./public/sitemap.xml");
sitemap.pipe(writeStream);

sitemap.write({ url: "/", changefreq: "daily", priority: 1 });
Object.values(ROUTES).forEach((route) => {
  sitemap.write({ url: route, changefreq: "monthly", priority: 0.8 });
});

sitemap.end();
