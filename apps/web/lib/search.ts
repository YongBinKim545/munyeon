import type { Neighborhood } from '@munyeon/db';

/** 동네 목록 JSON(압축 전송용): 시도는 번호로, 행은 [이름, 시도번호, 시군구, 위도, 경도](좌표는 동네 기관 좌표의 중앙값, 없으면 null) */
export interface NeighborhoodPayload {
  sido: string[];
  items: [string, number, string, number | null, number | null][];
}

export interface NeighborhoodItem {
  name: string;
  sido: string;
  sigungu: string;
  /** 시군구 자체 행(이름 = 시군구) */
  isSigungu: boolean;
  /** 위치 검색에서 고르면 메인 목록의 중심이 된다(D33) */
  lat: number | null;
  lon: number | null;
}

export const MIN_QUERY = 2;

export function normalizeQuery(q: string): string {
  return q.trim().replace(/\s+/g, ' ');
}

export function encodeNeighborhoods(list: Neighborhood[]): NeighborhoodPayload {
  const sido: string[] = [];
  const index = new Map<string, number>();
  const items = list.map((n): [string, number, string, number | null, number | null] => {
    let i = index.get(n.sido);
    if (i === undefined) {
      i = sido.push(n.sido) - 1;
      index.set(n.sido, i);
    }
    return [n.name, i, n.sigungu, n.lat, n.lon];
  });
  return { sido, items };
}

export function decodeNeighborhoods(p: NeighborhoodPayload): NeighborhoodItem[] {
  return p.items.map(([name, i, sigungu, lat = null, lon = null]) => ({ name, sido: p.sido[i] ?? '', sigungu, isSigungu: name === sigungu, lat, lon }));
}

/** 브라우저 안 동네 검색(D25): 앞부분 일치 먼저, 그다음 포함, 같은 순위면 짧은 이름 먼저 */
export function matchNeighborhoods(list: NeighborhoodItem[], q: string, limit = 5): NeighborhoodItem[] {
  const term = normalizeQuery(q);
  if (term.length < MIN_QUERY) return [];
  const scored: [number, NeighborhoodItem][] = [];
  for (const n of list) {
    const pos = n.name.indexOf(term);
    if (pos < 0) continue;
    scored.push([(pos === 0 ? 0 : 1000) + n.name.length, n]);
  }
  scored.sort((a, b) => a[0] - b[0]);
  return scored.slice(0, limit).map(([, n]) => n);
}
