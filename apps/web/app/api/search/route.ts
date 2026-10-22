import { gridCenter, parseGridKey, primaryBadge } from '@munyeon/core';
import { searchInstitutions } from '@munyeon/db';
import { query } from '@/lib/db';
import { MIN_QUERY, normalizeQuery } from '@/lib/search';

// 상호 검색(D33). 같은 검색어·격자 결과는 CDN에 하루 캐시한다. 검색어는 저장하지 않는다.
// g는 메인에서 보던 중심의 격자 번호(약 5km)이고, 좌표는 받지 않는다(D21).
export const dynamic = 'force-dynamic';

const MAX_QUERY = 30;
const LIMIT = 20;

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const q = normalizeQuery(params.get('q') ?? '');
  if (q.length < MIN_QUERY || q.length > MAX_QUERY) {
    return Response.json({ error: 'q must be 2-30 characters' }, { status: 400 });
  }
  const parsed = parseGridKey(params.get('g') ?? '');
  const cell = parsed?.level === 'coarse' ? parsed : null;
  const hits = await query('search', (sql) =>
    cell ? searchInstitutions(sql, q, LIMIT, gridCenter(cell)) : searchInstitutions(sql, q, LIMIT),
  );
  const items = hits.map((h) => ({
    id: h.id,
    kind: h.kind,
    name: h.name,
    sido: h.sido,
    sigungu: h.sigungu,
    tel: h.tel,
    lat: h.lat,
    lon: h.lon,
    // 목록에서 누르면 상세를 바로 그릴 수 있게 진료시간 원본도 보낸다(D51)
    hours: h.hours,
    badge: primaryBadge({ kind: h.kind, category: h.category, divName: h.divName, specialty: h.specialty }),
  }));
  return Response.json({ items }, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' } });
}
