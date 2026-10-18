import { primaryBadge } from '@munyeon/core';
import { getSql, searchInstitutions } from '@munyeon/db';
import { MIN_QUERY, normalizeQuery } from '@/lib/search';

// 요청마다 실행하되 같은 검색어 결과는 CDN에 하루 캐시한다(D25). 검색어는 저장하지 않는다.
export const dynamic = 'force-dynamic';

const MAX_QUERY = 30;

export async function GET(req: Request) {
  const q = normalizeQuery(new URL(req.url).searchParams.get('q') ?? '');
  if (q.length < MIN_QUERY || q.length > MAX_QUERY) {
    return Response.json({ error: 'q must be 2-30 characters' }, { status: 400 });
  }
  const hits = await searchInstitutions(getSql(), q, 10);
  const items = hits.map((h) => ({
    id: h.id,
    kind: h.kind,
    name: h.name,
    sido: h.sido,
    sigungu: h.sigungu,
    tel: h.tel,
    badge: primaryBadge({ kind: h.kind, category: h.category, divName: h.divName, specialty: h.specialty }),
  }));
  return Response.json({ items }, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' } });
}
