import { listRegion } from '@munyeon/db';
import { query } from '@/lib/db';
import { encodeGrid } from '@/lib/grid';
import { CURRENT_SIDO } from '@/lib/seo';

// 지역 화면(D69) 목록 데이터. 페이지 HTML에 넣지 않고 따로 받는다(D80: ISR 쓰기·DB 전송량 절감). CDN 1시간 캐시.
// 진료시간 원본만 보내고 영업 판정은 브라우저가 한다(D23). /api/region/{kind}?sido=…&sigungu=…
export const dynamic = 'force-dynamic';

const SIDO = new Set<string>(CURRENT_SIDO);

export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const q = new URL(req.url).searchParams;
  const sido = q.get('sido') ?? '';
  const sigungu = q.get('sigungu') ?? '';
  if ((kind !== 'pharmacy' && kind !== 'hospital') || !SIDO.has(sido) || !sigungu || sigungu.length > 30 || sigungu.includes('/')) {
    return Response.json({ error: 'bad kind or region' }, { status: 400 });
  }
  const rows = await query('region', (sql) => listRegion(sql, sido, sigungu, kind));
  return Response.json(encodeGrid(rows), { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=3600' } });
}
