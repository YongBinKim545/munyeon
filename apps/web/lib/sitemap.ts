import type { LandingCount } from '@munyeon/db';
import { regionPath } from './seo';

/** 파일 하나에 넣는 기관 수(네이버·구글 한도 5만보다 작게) */
export const SITEMAP_CHUNK = 10000;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function toKstIso(d: Date): string {
  return `${new Date(d.getTime() + 9 * 3_600_000).toISOString().slice(0, 19)}+09:00`;
}

export function buildUrlset(entries: { loc: string; lastmod?: Date }[]): string {
  const body = entries
    .map((e) => `<url><loc>${esc(e.loc)}</loc>${e.lastmod ? `<lastmod>${toKstIso(e.lastmod)}</lastmod>` : ''}</url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function buildIndex(locs: string[], lastmod: Date): string {
  const body = locs.map((l) => `<sitemap><loc>${esc(l)}</loc><lastmod>${toKstIso(lastmod)}</lastmod></sitemap>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

/** 0번 파일 = 지역 페이지, 1번부터 = 기관 상세 */
export function sitemapFileCount(institutionCount: number): number {
  return 1 + Math.ceil(institutionCount / SITEMAP_CHUNK);
}

/** 시도 페이지와 지역 화면(D69): 시군구(약국)는 늘, 시군구/병원은 병원이 있을 때 */
export function landingUrls(counts: LandingCount[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (p: string) => {
    if (!seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  };
  for (const c of counts) {
    push(regionPath(c.sido));
    push(regionPath(c.sido, c.sigungu));
    if (c.kind === 'hospital' && c.all > 0) push(regionPath(c.sido, c.sigungu, 'hospital'));
  }
  return out;
}
