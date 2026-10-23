import type { Kind } from '@munyeon/db';

/** 한 번에 이보다 많이 바뀌면(첫 동기화 등) 개별 갱신을 건너뛰고 7일 캐시 만료에 맡긴다(무료 한도 보호). */
export const MAX_REVALIDATE = 500;
/** 한 번에 갱신할 지역(시군구×유형) 수 상한. 넘으면 지역 페이지는 하루 캐시 만료에 맡긴다 */
export const MAX_REGIONS = 300;

/** 내용이 바뀐 기관이 속한 지역(P0-10). 웹이 시도·시군구·유형×상황 페이지를 함께 갱신한다 */
export interface RegionRef {
  kind: Kind;
  sido: string;
  sigungu: string;
}

/**
 * 캐시 갱신 요청(비밀값 포함)을 보내도 되는 자체 도메인(D44). 이 밖에는 우리 Vercel 배포(https://*.vercel.app)로만 보낸다.
 * munyeon.kr은 제3자 사이트라 절대 넣지 않는다(D40).
 */
export const OWN_DOMAINS: readonly string[] = ['findmedi.co.kr', 'www.findmedi.co.kr'];

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

/**
 * 내용이 바뀐 기관의 상세 페이지와 그 기관이 속한 지역 페이지 캐시를 지워 달라고 웹에 요청한다.
 * 실패해도 동기화를 막지 않는다. 어느 한쪽이 상한을 넘으면 그쪽만 빼고 보낸다.
 */
export async function requestRevalidate(
  allItems: { kind: Kind; id: string }[],
  { baseUrl, secret, fetchImpl = fetch }: RevalidateOptions,
  allRegions: RegionRef[] = [],
): Promise<'sent' | 'skipped' | 'failed' | 'untrusted'> {
  if (!isTrustedBaseUrl(baseUrl)) return 'untrusted';
  const items = allItems.length > MAX_REVALIDATE ? [] : allItems;
  const regions = allRegions.length > MAX_REGIONS ? [] : allRegions;
  if (items.length === 0 && regions.length === 0) return 'skipped';
  try {
    const res = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/api/revalidate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(regions.length ? { items, regions } : { items }),
      signal: AbortSignal.timeout(30_000),
    });
    return res.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}
