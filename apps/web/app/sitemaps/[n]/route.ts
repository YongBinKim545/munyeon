import { listLandingCounts, listSitemapEntries } from '@munyeon/db';
import { query } from '@/lib/db';
import { institutionPath, SITE_URL } from '@/lib/seo';
import { buildUrlset, SITEMAP_CHUNK, landingUrls } from '@/lib/sitemap';

// /sitemaps/0.xml = 지역 페이지, /sitemaps/{n}.xml = 기관 상세 1만 개씩(색인 대상만). CDN 1시간 캐시.
export const dynamic = 'force-dynamic';

const HEADERS = { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=3600' };

export async function GET(_req: Request, { params }: { params: Promise<{ n: string }> }) {
  const m = /^(\d{1,4})\.xml$/.exec((await params).n);
  if (!m) return new Response('not found', { status: 404 });
  const n = Number(m[1]);
  if (n === 0) {
    const urls = landingUrls(await query('sitemap0', (sql) => listLandingCounts(sql), { timeoutMs: 15_000 })).map((p) => ({ loc: SITE_URL + p }));
    return new Response(buildUrlset([{ loc: `${SITE_URL}/` }, { loc: `${SITE_URL}/regions` }, ...urls]), { headers: HEADERS });
  }

  const rows = await query('sitemapN', (sql) => listSitemapEntries(sql, (n - 1) * SITEMAP_CHUNK, SITEMAP_CHUNK), { timeoutMs: 15_000 });
  if (rows.length === 0) return new Response('not found', { status: 404 });
  return new Response(
    buildUrlset(rows.map((r) => ({ loc: SITE_URL + institutionPath(r.kind, r.id), lastmod: r.updatedAt }))),
    { headers: HEADERS },
  );
}
