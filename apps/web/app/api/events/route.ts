import { EVENT_TYPES, getSql, insertEvent, type EventType } from '@munyeon/db';

// 자체 이벤트 수집(D15). 기관 ID·종류·페이지 종류만 저장하고 IP·UA·좌표는 받지 않는다.
export const dynamic = 'force-dynamic';

const MAX_BODY = 1024;
const ID_RE = /^[A-Za-z0-9]{1,20}$/;
const PAGE_RE = /^[a-z_]{1,32}$/;

export async function POST(req: Request) {
  const text = await req.text(); // sendBeacon은 text/plain으로 보낸다
  if (text.length > MAX_BODY) return new Response(null, { status: 413 });
  let body: { type?: unknown; institutionId?: unknown; page?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const { type, institutionId, page } = body;
  const validType = typeof type === 'string' && (EVENT_TYPES as readonly string[]).includes(type);
  const validId = institutionId === null || (typeof institutionId === 'string' && ID_RE.test(institutionId));
  const validPage = typeof page === 'string' && PAGE_RE.test(page);
  if (!validType || !validId || !validPage) return new Response(null, { status: 400 });

  await insertEvent(getSql(), { type: type as EventType, institutionId: institutionId as string | null, page: page as string });
  return new Response(null, { status: 204 });
}
