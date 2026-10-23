import { timingSafeEqual } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { CURRENT_SIDO, institutionPath, regionPath, SITUATIONS, type Kind, type Situation } from '@/lib/seo';

// 워커가 내용이 바뀐 기관을 알려주면 그 상세 페이지 캐시를 지운다(다음 방문 때 다시 만듦, D23).
// 그 기관이 속한 지역(시군구×유형)도 받으면 시도·시군구·유형×상황 페이지와 지역으로 찾기도 함께 지운다(P0-10).
export const dynamic = 'force-dynamic';

const MAX_ITEMS = 500;
const MAX_REGIONS = 300;
const SIDO = new Set(CURRENT_SIDO);

type RegionRef = { kind: Kind; sido: string; sigungu: string };

function isRegion(r: unknown): r is RegionRef {
  const x = r as RegionRef;
  return !!x && typeof x === 'object' && (x.kind === 'pharmacy' || x.kind === 'hospital') && SIDO.has(x.sido)
    && typeof x.sigungu === 'string' && x.sigungu.length > 0 && x.sigungu.length <= 30 && !x.sigungu.includes('/');
}
const ID_RE = /^[A-Za-z0-9]{1,20}$/;

function authorized(header: string | null): boolean {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || !header?.startsWith('Bearer ')) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorized(req.headers.get('authorization'))) return new Response(null, { status: 401 });
  let items: { kind?: unknown; id?: unknown }[];
  let regions: unknown[];
  try {
    const body = (await req.json()) as { items?: typeof items; regions?: unknown } | null;
    if (!body || typeof body !== 'object' || !Array.isArray(body.items)) return new Response(null, { status: 400 });
    items = body.items;
    regions = body.regions === undefined ? [] : Array.isArray(body.regions) ? body.regions : [null];
  } catch {
    return new Response(null, { status: 400 });
  }
  const valid = Array.isArray(items) && items.length <= MAX_ITEMS
    && items.every((i) => !!i && typeof i === 'object' && (i.kind === 'pharmacy' || i.kind === 'hospital') && typeof i.id === 'string' && ID_RE.test(i.id));
  if (!valid || regions.length > MAX_REGIONS || !regions.every(isRegion)) return new Response(null, { status: 400 });
  for (const i of items) revalidatePath(institutionPath(i.kind as Kind, i.id as string));
  const paths = new Set<string>();
  for (const r of regions as RegionRef[]) {
    paths.add(regionPath(r.sido));
    paths.add(regionPath(r.sido, r.sigungu));
    for (const s of Object.keys(SITUATIONS) as Situation[]) paths.add(regionPath(r.sido, r.sigungu, r.kind, s));
  }
  if (paths.size) paths.add('/regions');
  for (const p of paths) revalidatePath(p);
  return Response.json({ revalidated: items.length, regionPaths: paths.size });
}
