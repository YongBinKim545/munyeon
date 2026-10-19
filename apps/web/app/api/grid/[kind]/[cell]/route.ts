import { parseGridKey } from '@munyeon/core';
import { getSql, listGridCell } from '@munyeon/db';
import { encodeGrid } from '@/lib/grid';

// 메인 목록용 격자 한 칸(D21·D35). 진료시간 원본만 보내고 영업 판정은 브라우저가 한다. CDN 1시간 캐시.
// cell은 약 5km 칸 "834_2267" 또는 첫 화면용 약 1km 칸 "f4173_11337".
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string; cell: string }> }) {
  const { kind, cell } = await params;
  const c = parseGridKey(cell);
  if ((kind !== 'pharmacy' && kind !== 'hospital') || !c) {
    return Response.json({ error: 'bad kind or cell' }, { status: 400 });
  }
  const rows = await listGridCell(getSql(), kind, c.gy, c.gx, c.level);
  return Response.json(encodeGrid(rows), { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=3600' } });
}
