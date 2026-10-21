import type { RawHours } from '@munyeon/core';
import type { Kind } from './seo';

/**
 * 기관 상세를 즉시 그리기 위한 미리 보기 정보(D45). 메인 목록·이름 검색에서 누를 때 그 화면이 가진 정보를 넘긴다.
 * 이 탭의 메모리에만 둔다(저장하거나 서버로 보내지 않음). 서버 페이지가 오면 그쪽이 화면을 대신한다.
 */
export interface DetailPreview {
  kind: Kind;
  id: string;
  name: string;
  badge: string;
  pediatric: boolean;
  tel: string | null;
  /** 이름 검색 결과에는 진료시간이 없다 */
  hours: RawHours | null;
  sido: string | null;
  sigungu: string | null;
  /** '마포구 망원동' 같은 동네 표시 */
  area: string;
  lat: number | null;
  lon: number | null;
  holidays: string[];
}

const MAX = 20;
const store = new Map<string, DetailPreview>();
const keyOf = (kind: Kind, id: string) => `${kind}/${id}`;

export function rememberPreview(p: DetailPreview): void {
  const k = keyOf(p.kind, p.id);
  store.delete(k);
  store.set(k, p);
  // 오래된 것부터 지워 메모리를 일정하게 유지한다
  while (store.size > MAX) store.delete(store.keys().next().value as string);
}

export function readPreview(kind: Kind, id: string): DetailPreview | null {
  return store.get(keyOf(kind, id)) ?? null;
}

/** 테스트용 */
export function clearPreviews(): void {
  store.clear();
}
