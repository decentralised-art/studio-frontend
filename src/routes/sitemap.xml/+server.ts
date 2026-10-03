import { absoluteUrl, SITEMAP_PATHS } from "$lib/seo/site";

export const prerender = true;

export const GET = () => {
  const urls = SITEMAP_PATHS.map((path) => `  <url><loc>${absoluteUrl(path)}</loc></url>`).join(
    "\n",
  );
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
