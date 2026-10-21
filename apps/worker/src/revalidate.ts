import type { Kind } from '@munyeon/db';

/** 한 번에 이보다 많이 바뀌면(첫 동기화 등) 개별 갱신을 건너뛰고 7일 캐시 만료에 맡긴다(무료 한도 보호). */
export const MAX_REVALIDATE = 500;

/**
 * 캐시 갱신 요청(비밀값 포함)을 보내도 되는 자체 도메인. 정식 도메인이 확정되면 여기에 추가한다.
 * 그전에는 우리 Vercel 배포(https://*.vercel.app)로만 보낸다(2026-10-21: 예정했던 도메인을 남이 사용 중).
 */
export const OWN_DOMAINS: readonly string[] = [];

/** WEB_BASE_URL이 우리 웹인지: https이고 *.vercel.app 또는 자체 도메인 */
export function isTrustedBaseUrl(baseUrl: string, ownDomains: readonly string[] = OWN_DOMAINS): boolean {
  try {
    const u = new URL(baseUrl);
    return u.protocol === 'https:' && (u.hostname.endsWith('.vercel.app') || ownDomains.includes(u.hostname));
  } catch {
    return false;
  }
}

export interface RevalidateOptions {
  baseUrl: string;
  secret: string;
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
}

/** 내용이 바뀐 기관의 상세 페이지 캐시를 지워 달라고 웹에 요청한다. 실패해도 동기화를 막지 않는다. */
export async function requestRevalidate(
  items: { kind: Kind; id: string }[],
  { baseUrl, secret, fetchImpl = fetch }: RevalidateOptions,
): Promise<'sent' | 'skipped' | 'failed' | 'untrusted'> {
  if (!isTrustedBaseUrl(baseUrl)) return 'untrusted';
  if (items.length === 0 || items.length > MAX_REVALIDATE) return 'skipped';
  try {
    const res = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/api/revalidate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
      signal: AbortSignal.timeout(30_000),
    });
    return res.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}
