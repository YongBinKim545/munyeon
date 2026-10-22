import { getSql, insertFeedback } from '@munyeon/db';
import { validateFeedback } from '@/lib/feedback';

// 개선의견·수정요청(D49). 검사한 값만 저장하고 IP·UA·좌표는 받지 않는다.
export const dynamic = 'force-dynamic';

const MAX_BODY = 4096;

/** 함수 인스턴스마다 10초에 RATE_LIMIT건까지만 받는다(무료 DB를 채우는 스크립트를 막는 최소 장치). */
export const RATE_LIMIT = 20;
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
  const text = await req.text();
  if (text.length > MAX_BODY) return new Response(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: '보낼 수 없는 내용이에요' }, { status: 400 });
  }
  const v = validateFeedback(body);
  if (!v.ok) return Response.json({ error: v.error }, { status: 400 });
  if (!allow()) return new Response(null, { status: 429 });
  // 10분 안에 같은 내용이면 저장하지 않지만, 보낸 사람에게는 똑같이 성공으로 알린다
  await insertFeedback(getSql(), v.value);
  return new Response(null, { status: 204 });
}
