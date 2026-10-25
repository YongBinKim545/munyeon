/**
 * 유입 경로 큰 분류(P0-11, D60·D72). 처음 들어온 페이지에서 브라우저가 한 번 정하고, 이벤트에는 이 값만 보낸다.
 * 출처 주소·검색어 원문은 저장하지 않는다(D15).
 */
export const TRAFFIC_SOURCES = ['search', 'share', 'direct', 'community', 'ad', 'other'] as const;
export type TrafficSource = (typeof TRAFFIC_SOURCES)[number];

const AD_MEDIUMS = new Set(['cpc', 'ad', 'paid']);
const COMMUNITY_MEDIUMS = new Set(['blog', 'community', 'cafe', 'social']);

/** 호스트가 이 이름이거나 그 하위 도메인이면 맞는다 */
const SEARCH_HOSTS = ['search.naver.com', 'search.daum.net', 'bing.com', 'zum.com', 'duckduckgo.com', 'search.yahoo.com'];
const COMMUNITY_HOSTS = [
  'blog.naver.com', 'cafe.naver.com', 'cafe.daum.net', 'tistory.com', 'dcinside.com', 'theqoo.net', 'clien.net', 'fmkorea.com',
  'ruliweb.com', 'instiz.net', 'ppomppu.co.kr', 'mlbpark.donga.com', 'facebook.com', 'instagram.com', 'threads.net', 'x.com',
  'twitter.com', 'band.us',
];
/** www.google.com, google.co.kr 등 */
const GOOGLE = /(^|\.)google\.[a-z.]+$/;
const KAKAOTALK = /KAKAOTALK/i;

const under = (host: string, list: string[]) => list.some((d) => host === d || host.endsWith(`.${d}`));

/**
 * 꼬리표(ref·utm) → 다른 사이트에서 온 출처 주소 → 카카오톡 앱 안 브라우저(공유로 봄) → 직접 순으로 정한다.
 * 카카오톡에서 연 링크는 출처 주소가 비어 '직접'으로 잡히기 쉬워, 단톡방 공유로 본다(사용자 결정).
 */
export function classifySource(input: { search: string; referrer: string; ua: string; host: string }): TrafficSource {
  const q = new URLSearchParams(input.search);
  if (q.get('ref') === 'share') return 'share';
  const medium = q.get('utm_medium')?.toLowerCase();
  if (medium !== undefined || q.has('utm_source') || q.has('utm_campaign')) {
    if (medium && AD_MEDIUMS.has(medium)) return 'ad';
    if (medium && COMMUNITY_MEDIUMS.has(medium)) return 'community';
    return 'other';
  }
  let from = '';
  try {
    from = input.referrer ? new URL(input.referrer).hostname : '';
  } catch {
    from = '';
  }
  if (from && from !== input.host) {
    if (GOOGLE.test(from) || under(from, SEARCH_HOSTS)) return 'search';
    if (under(from, COMMUNITY_HOSTS)) return 'community';
    return 'other';
  }
  if (KAKAOTALK.test(input.ua)) return 'share';
  return 'direct';
}

export function isTrafficSource(v: unknown): v is TrafficSource {
  return typeof v === 'string' && (TRAFFIC_SOURCES as readonly string[]).includes(v);
}
