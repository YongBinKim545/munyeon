import { EVENT_TYPES, getSql, insertEvent, type EventType } from '@munyeon/db';

// 자체 이벤트 수집(D15). 기관 ID·종류·페이지 종류만 저장하고 IP·UA·좌표는 받지 않는다.
export const dynamic = 'force-dynamic';

const MAX_BODY = 1024;
const ID_RE = /^[A-Za-z0-9]{1,20}$/;
const PAGE_RE = /^[a-z_]{1,32}$/;

/**
 * 함수 인스턴스마다 10초에 RATE_LIMIT건까지만 쓴다. 스크립트로 무료 DB(500MB)를 채우는 것을 막는 최소 장치.
 * 명절 피크에 정상 요청이 막히면 값을 올리거나 Vercel 방화벽 규칙으로 옮긴다.
 */
export const RATE_LIMIT = 200;
const WINDOW_MS = 10_000;
let windowStart = 0;
let windowCount = 0;

export function resetRateLimit(): void {
  windowStart = 0;
  windowCount = 0;
}

function allow(now = Date.now()): boolean {
  if (now - windowStart > WINDOW_MS) {
    windowStart = now;
    windowCount = 0;
  }
  windowCount += 1;
  return windowCount <= RATE_LIMIT;
}

export async function POST(req: Request) {
  const text = await req.text(); // sendBeacon은 text/plain으로 보낸다
  if (text.length > MAX_BODY) return new Response(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return new Response(null, { status: 400 });
  const { type, institutionId, page } = body as { type?: unknown; institutionId?: unknown; page?: unknown };
  const validType = typeof type === 'string' && (EVENT_TYPES as readonly string[]).includes(type);
  const validId = institutionId === null || (typeof institutionId === 'string' && ID_RE.test(institutionId));
  const validPage = typeof page === 'string' && PAGE_RE.test(page);
  if (!validType || !validId || !validPage) return new Response(null, { status: 400 });
  if (!allow()) return new Response(null, { status: 429 });

  await insertEvent(getSql(), { type: type as EventType, institutionId: institutionId as string | null, page: page as string });
  return new Response(null, { status: 204 });
}
