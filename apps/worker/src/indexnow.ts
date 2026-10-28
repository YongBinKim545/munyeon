import type { Kind } from '@munyeon/db';
import type { RegionRef } from './revalidate.ts';

/**
 * IndexNow(P1-1, D75): 수집 뒤 바뀐 기관 상세와 그 지역 화면 주소만 네이버·Bing 등에 바로 알린다.
 * 키는 사이트에 공개하는 값이다(apps/web/public/{키}.txt). 비밀값이 아니다.
 */
export const INDEXNOW_KEY = '83ab9c56d3495635cd3cc87d937cc191';
/** 정식 도메인일 때만 보낸다(미리보기·다른 주소는 보내지 않음) */
export const INDEXNOW_HOST = 'findmedi.co.kr';
/** 한 번에 이보다 많이 바뀌면(첫 수집·대량 갱신) 보내지 않는다. 일괄 전송은 사이트맵에 맡긴다 */
export const MAX_INDEXNOW = 1000;
const ENDPOINT = 'https://api.indexnow.org/indexnow';

const enc = encodeURIComponent;

/** 웹의 institutionPath·regionPath와 같은 주소(약국 지역 화면 /시도/시군구, 병원 /시도/시군구/병원) */
export function indexNowUrls(items: { kind: Kind; id: string }[], regions: RegionRef[], baseUrl: string): string[] {
  const origin = baseUrl.replace(/\/+$/, '');
  const urls = [
    ...items.map((i) => `${origin}/${i.kind}/${enc(i.id)}`),
    ...regions.map((r) => `${origin}/${enc(r.sido)}/${enc(r.sigungu)}${r.kind === 'hospital' ? `/${enc('병원')}` : ''}`),
  ];
  return [...new Set(urls)];
}

export interface IndexNowOptions {
  baseUrl: string;
  /** 저장소 변수 INDEXNOW_ENABLED. 'false'면 끈다 */
  enabled?: string;
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
}

/** 실패해도 수집을 막지 않는다. 결과는 로그용 문자열 */
export async function submitIndexNow(urls: string[], { baseUrl, enabled, fetchImpl = fetch }: IndexNowOptions): Promise<string> {
  let host = '';
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    // 아래에서 off
  }
  if (enabled === 'false' || host !== INDEXNOW_HOST) return 'off';
  if (urls.length === 0) return 'skipped';
  if (urls.length > MAX_INDEXNOW) return 'too-many';
  try {
    const res = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: INDEXNOW_HOST, key: INDEXNOW_KEY, keyLocation: `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`, urlList: urls }),
      signal: AbortSignal.timeout(30_000),
    });
    return res.ok ? 'sent' : `failed ${res.status}`;
  } catch {
    return 'failed';
  }
}
