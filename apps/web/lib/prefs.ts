import type { Kind } from './seo';

/**
 * 브라우저에만 저장하는 값(D34). 서버로 보내지 않는다.
 * 저장소가 막혀 있으면(사생활 보호 모드 등) 기본값으로 동작한다.
 * 상태(영업 중/전체)는 저장하지 않는다 — 들어올 때마다 '영업 중'.
 */
export interface Area {
  /** '마포구 망원동' */
  label: string;
  lat: number;
  lon: number;
}

const KIND_KEY = 'munyeon:kind';
const AREAS_KEY = 'munyeon:areas';
const GRID_KEY = 'munyeon:lastGrid';
export const MAX_RECENT_AREAS = 3;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 저장 실패는 무시
  }
}

export function readKind(): Kind {
  return read(KIND_KEY) === 'hospital' ? 'hospital' : 'pharmacy';
}

export function saveKind(k: Kind): void {
  write(KIND_KEY, k);
}

function isArea(a: unknown): a is Area {
  const x = a as Area;
  return !!x && typeof x.label === 'string' && Number.isFinite(x.lat) && Number.isFinite(x.lon);
}

export function readRecentAreas(): Area[] {
  try {
    const list = JSON.parse(read(AREAS_KEY) ?? '[]') as unknown;
    return Array.isArray(list) ? list.filter(isArea).slice(0, MAX_RECENT_AREAS) : [];
  } catch {
    return [];
  }
}

/** 고른 지역을 맨 앞에. 같은 이름은 하나만 남기고 최대 3개. */
export function pushRecentArea(a: Area): Area[] {
  const next = [a, ...readRecentAreas().filter((x) => x.label !== a.label)].slice(0, MAX_RECENT_AREAS);
  write(AREAS_KEY, JSON.stringify(next));
  return next;
}

/** 상호 검색 정렬용으로 메인에서 보던 중심의 약 5km 격자 번호(좌표가 아니다) */
export function saveLastCenterGrid(key: string): void {
  write(GRID_KEY, key);
}

export function readLastCenterGrid(): string | null {
  return read(GRID_KEY);
}
