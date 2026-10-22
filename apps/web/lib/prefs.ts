import type { ListFilter } from './nearby';

/**
 * 브라우저에만 저장하는 값(D34). 서버로 보내지 않는다.
 * 저장소가 막혀 있으면(사생활 보호 모드 등) 기본값으로 동작한다.
 * 목록은 들어올 때마다 영업 중으로 시작한다([전체 보기]는 저장하지 않는다).
 */
export interface Area {
  /** '마포구 망원동' */
  label: string;
  lat: number;
  lon: number;
  /** 지역으로 찾기에서 '내 지역'을 맨 위에 두는 데 쓴다(D53). 예전에 저장된 값에는 없다 */
  sido?: string | null;
  sigungu?: string | null;
}

const KIND_KEY = 'munyeon:kind';
const AREAS_KEY = 'munyeon:areas';
const CENTER_KEY = 'munyeon:lastCenter';
const LAST_AREA_KEY = 'munyeon:lastArea';
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

/** 메인 유형(D41). 처음은 약국, 이후 마지막 선택 */
export function readFilter(): ListFilter {
  const v = read(KIND_KEY);
  return v === 'hospital' || v === 'pediatric' ? v : 'pharmacy';
}

export function saveFilter(f: ListFilter): void {
  write(KIND_KEY, f);
}

function isArea(a: unknown): a is Area {
  const x = a as Area;
  return !!x && typeof x.label === 'string' && Number.isFinite(x.lat) && Number.isFinite(x.lon);
}

/**
 * 마지막으로 보던 지역(D45). 현재 위치로 찾은 곳도 이름이 정해지면 저장해, 새로고침하면 여기서 다시 시작한다.
 * 지역 검색의 "최근 지역" 목록(직접 고른 곳)과는 따로 둔다. 이 브라우저에만 남는다.
 */
export function saveLastArea(a: Area): void {
  write(LAST_AREA_KEY, JSON.stringify({ label: a.label, lat: a.lat, lon: a.lon, sido: a.sido ?? null, sigungu: a.sigungu ?? null }));
}

export function readLastArea(): Area | null {
  try {
    const a = JSON.parse(read(LAST_AREA_KEY) ?? 'null') as unknown;
    return isArea(a) ? a : null;
  } catch {
    return null;
  }
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

/**
 * 메인에서 보던 중심. 상호 검색이 거리 표시에 쓰고, 서버에는 이 점의 약 5km 격자 번호만 보낸다(D21).
 * 좌표는 이 브라우저에만 남는다.
 */
export function saveLastCenter(c: { lat: number; lon: number }): void {
  write(CENTER_KEY, JSON.stringify({ lat: c.lat, lon: c.lon }));
}

export function readLastCenter(): { lat: number; lon: number } | null {
  try {
    const c = JSON.parse(read(CENTER_KEY) ?? 'null') as { lat?: unknown; lon?: unknown } | null;
    return c && Number.isFinite(c.lat) && Number.isFinite(c.lon) ? { lat: c.lat as number, lon: c.lon as number } : null;
  } catch {
    return null;
  }
}
