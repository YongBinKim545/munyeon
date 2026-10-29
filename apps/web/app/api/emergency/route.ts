import { listEmergency } from '@munyeon/db';
import { query } from '@/lib/db';
import { encodeGrid } from '@/lib/grid';

// 전국 응급실 운영 병원(D78, 약 520곳). 격자와 같은 모양으로 보내고 거리는 브라우저가 계산한다(D21). CDN 하루 캐시.
// 전화는 응급실 전용 번호가 있으면 그 번호.
export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await query('emergency', (sql) => listEmergency(sql));
  const payload = encodeGrid(rows.map(({ erTel, ...r }) => ({ ...r, tel: erTel ?? r.tel })));
  return Response.json(payload, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' } });
}
