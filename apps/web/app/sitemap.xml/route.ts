import { countSitemapEntries, getSql } from '@munyeon/db';
import { SITE_URL } from '@/lib/seo';
import { buildIndex, sitemapFileCount } from '@/lib/sitemap';

// 사이트맵 인덱스. 요청 시 만들고 CDN에 1시간 캐시(D23).
export const dynamic = 'force-dynamic';

export async function GET() {
  const files = sitemapFileCount(await countSitemapEntries(getSql()));
  const locs = Array.from({ length: files }, (_, i) => `${SITE_URL}/sitemaps/${i}.xml`);
  return new Response(buildIndex(locs, new Date()), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=3600' },
  });
}
