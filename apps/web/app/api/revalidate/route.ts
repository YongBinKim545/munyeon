import { timingSafeEqual } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { institutionPath, type Kind } from '@/lib/seo';

// 워커가 내용이 바뀐 기관을 알려주면 그 상세 페이지 캐시만 지운다(다음 방문 때 다시 만듦, D23).
export const dynamic = 'force-dynamic';

const MAX_ITEMS = 500;
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
  try {
    const body = (await req.json()) as { items?: typeof items } | null;
    if (!body || typeof body !== 'object' || !Array.isArray(body.items)) return new Response(null, { status: 400 });
    items = body.items;
  } catch {
    return new Response(null, { status: 400 });
  }
  const valid = Array.isArray(items) && items.length <= MAX_ITEMS
    && items.every((i) => !!i && typeof i === 'object' && (i.kind === 'pharmacy' || i.kind === 'hospital') && typeof i.id === 'string' && ID_RE.test(i.id));
  if (!valid) return new Response(null, { status: 400 });
  for (const i of items) revalidatePath(institutionPath(i.kind as Kind, i.id as string));
  return Response.json({ revalidated: items.length });
}
