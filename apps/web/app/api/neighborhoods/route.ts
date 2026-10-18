import { getSql, listNeighborhoods } from '@munyeon/db';
import { encodeNeighborhoods } from '@/lib/search';

// 동네 목록(약 5천 개, 압축 약 40~60KB). 검색창을 처음 누를 때 한 번 받는다. CDN 하루 캐시.
export const dynamic = 'force-dynamic';

export async function GET() {
  const payload = encodeNeighborhoods(await listNeighborhoods(getSql()));
  return Response.json(payload, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400' } });
}
