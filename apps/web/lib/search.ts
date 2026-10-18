import type { Neighborhood } from '@munyeon/db';

/** 동네 목록 JSON(압축 전송용): 시도는 번호로, 행은 [이름, 시도번호, 시군구] */
export interface NeighborhoodPayload {
  sido: string[];
  items: [string, number, string][];
}

export interface NeighborhoodItem {
  name: string;
  sido: string;
  sigungu: string;
  /** 시군구 자체 행(이름 = 시군구) */
  isSigungu: boolean;
}

export const MIN_QUERY = 2;

export function normalizeQuery(q: string): string {
  return q.trim().replace(/\s+/g, ' ');
}

export function encodeNeighborhoods(list: Neighborhood[]): NeighborhoodPayload {
  const sido: string[] = [];
  const index = new Map<string, number>();
  const items = list.map((n): [string, number, string] => {
    let i = index.get(n.sido);
    if (i === undefined) {
      i = sido.push(n.sido) - 1;
      index.set(n.sido, i);
    }
    return [n.name, i, n.sigungu];
  });
  return { sido, items };
}

export function decodeNeighborhoods(p: NeighborhoodPayload): NeighborhoodItem[] {
  return p.items.map(([name, i, sigungu]) => ({ name, sido: p.sido[i] ?? '', sigungu, isSigungu: name === sigungu }));
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
