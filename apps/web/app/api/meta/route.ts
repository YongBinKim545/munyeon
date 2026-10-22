import { getHolidays, getLastSyncAt } from '@munyeon/db';
import { query } from '@/lib/db';

// 캐시된 페이지가 새 공휴일(임시공휴일 등)과 최근 동기화 시각을 반영하도록 브라우저가 받아 쓰는 작은 정보(리뷰 #3·#8).
// 정적 정보라 CDN에 10분 캐시한다. 영업 상태는 넣지 않는다.
export const dynamic = 'force-dynamic';

export async function GET() {
  const y = new Date(Date.now() + 9 * 3_600_000).getUTCFullYear();
  const [holidays, hospital, pharmacy] = await query('meta', (sql) =>
    Promise.all([getHolidays(sql, `${y}-01-01`, `${y + 1}-12-31`), getLastSyncAt(sql, 'hospital'), getLastSyncAt(sql, 'pharmacy')]),
  );
  return Response.json(
    { holidays, lastSync: { hospital: hospital?.toISOString() ?? null, pharmacy: pharmacy?.toISOString() ?? null } },
    { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=600' } },
  );
}
