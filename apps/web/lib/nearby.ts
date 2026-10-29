import {
  cellsWithin, distanceM, gridKey, orderList, parseWeeklyHours, sidoShort, tierOf,
  type GridLevel, type LatLon, type ListTier, type StatusContext,
} from '@munyeon/core';
import { decodeGrid, type GridEntry, type GridPayload } from './grid';
import type { Kind } from './seo';

/**
 * 목록 필터(D41·D78): 약국 / 병원 전체 / 소아과 / 산부인과 / 치과 / 응급실.
 * 화면에서는 [병원 | 약국]과 병원일 때만 진료과 드롭다운 두 개로 나뉜다.
 */
export type ListFilter = 'pharmacy' | 'hospital' | 'pediatric' | 'obgyn' | 'dental' | 'emergency';
export type HospitalFilter = Exclude<ListFilter, 'pharmacy'>;
export const HOSPITAL_FILTERS: readonly HospitalFilter[] = ['hospital', 'pediatric', 'obgyn', 'dental', 'emergency'];
/** 진료과 드롭다운 이름 */
export const FILTER_LABEL: Record<HospitalFilter, string> = { hospital: '전체', pediatric: '소아과', obgyn: '산부인과', dental: '치과', emergency: '응급실' };

export function isListFilter(v: unknown): v is ListFilter {
  return v === 'pharmacy' || (HOSPITAL_FILTERS as readonly unknown[]).includes(v);
}

/** 약국 외에는 병원 격자를 받는다(같은 칸을 다시 받지 않는다). 응급실은 격자 대신 전국 응급실 목록을 쓴다 */
export function kindOf(filter: ListFilter): Kind {
  return filter === 'pharmacy' ? 'pharmacy' : 'hospital';
}

/**
 * 진료과 거르기. 나머지(약국·병원 전체)는 거르지 않는다.
 * - 소아과: 이름에 소아청소년과·소아과 또는 소아·아동·어린이·키즈가 들어간 일반 병·의원(격자의 pediatric 표시)
 * - 산부인과: 이름에 산부인과·여성의원이 들어가거나 주 진료과(배지)가 산부인과인 일반 병·의원
 * - 치과: 종별이 치과(치과의원·치과병원)
 */
export function matcherOf(filter: ListFilter): ((e: GridEntry) => boolean) | undefined {
  if (filter === 'pediatric') return (e) => e.pediatric;
  if (filter === 'obgyn') return (e) => e.category === 'general' && (e.badge === '산부인과' || /산부인과|여성의원/.test(e.name));
  if (filter === 'dental') return (e) => e.category === 'dental';
  return undefined;
}

/** 메인 목록 한 줄. 상태는 브라우저에서만 계산한다. */
export interface ViewItem extends GridEntry {
  distanceM: number;
  tier: ListTier;
  opensAt?: Date;
  weekdayLabel?: string;
  /** 응급실 목록(D78): 진료시간 대신 '응급실 24시간'으로 보인다 */
  emergency?: boolean;
}

/** 반경 단계(D36·기능 정의서 4.4): 1km(약 1km 칸)를 먼저, 이어서 3km → 부족하면 10km → 25km */
export const FIRST_RADIUS_KM = 1;
export const RADII_KM = [3, 10, 25] as const;
/** '영업 중' 상태에서 보여줄 곳(영업 중·곧 영업·전화 확인 필요)이 이보다 적으면 넓힌다 */
export const MIN_VISIBLE = 5;
const CONCURRENCY = 6;

export type FetchJson = (url: string) => Promise<GridPayload>;

export const defaultFetchJson: FetchJson = (url) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`grid ${r.status}`);
    return r.json() as Promise<GridPayload>;
  });

/** 칸 단위 캐시(종류·칸 번호별). 같은 칸은 다시 받지 않는다. null은 받기 실패(캐시에서 지워 다음에 다시 시도). */
export type CellCache = Map<string, Promise<GridEntry[] | null>>;

export function cellUrls(kind: Kind, center: LatLon, radiusKm: number, level: GridLevel): string[] {
  return cellsWithin(center, radiusKm, level).map((c) => `/api/grid/${kind}/${gridKey(c, level)}`);
}

/**
 * URL 목록을 받아(캐시 우선, 동시 6개) 기관을 합친다. 같은 기관은 ID로 한 번만.
 * 실패한 칸 수를 함께 돌려준다 — 실패를 '문 연 곳 없음'으로 보이지 않게 하려는 것이다.
 */
export async function loadCells(
  kind: Kind,
  urls: string[],
  cache: CellCache,
  fetchJson: FetchJson = defaultFetchJson,
): Promise<{ entries: GridEntry[]; failed: number }> {
  const queue = urls.filter((u) => !cache.has(u));
  const run = async () => {
    for (let u = queue.shift(); u; u = queue.shift()) {
      const url = u;
      cache.set(url, fetchJson(url).then((p): GridEntry[] | null => decodeGrid(p, kind)).catch(() => {
        cache.delete(url); // 다음 번에 다시 시도
        return null;
      }));
      await cache.get(url);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, run));
  const lists = await Promise.all(urls.map((u) => cache.get(u) ?? Promise.resolve(null)));
  const byId = new Map<string, GridEntry>();
  let failed = 0;
  for (const list of lists) {
    if (!list) failed += 1;
    else for (const e of list) byId.set(e.id, e);
  }
  return { entries: [...byId.values()], failed };
}

/** 거리·상태를 계산하고 반경 안만 순서 규칙(D32)대로 정렬한다. */
export function buildView(
  entries: GridEntry[], center: LatLon, radiusKm: number, at: Date, ctx: StatusContext, mode: 'open' | 'all',
): ViewItem[] {
  const limit = radiusKm * 1000;
  const items: ViewItem[] = [];
  for (const e of entries) {
    const d = distanceM(center, e);
    if (d > limit) continue;
    const hours = parseWeeklyHours(e.hours);
    items.push({ ...e, distanceM: d, ...tierOf(hours, at, ctx) });
  }
  return orderList(items, mode);
}

export function visibleCount(
  entries: GridEntry[], center: LatLon, radiusKm: number, at: Date, ctx: StatusContext, match?: (e: GridEntry) => boolean,
): number {
  return buildView(match ? entries.filter(match) : entries, center, radiusKm, at, ctx, 'open').length;
}

/** 응급실 목록에 보여 줄 수(D78). 거리 제한 없이 가까운 순(시골에서도 가장 가까운 곳이 나오게) */
export const EMERGENCY_LIMIT = 20;

/** 응급실 목록(D78): 진료시간(외래)으로 판정하지 않고 모두 '응급실 24시간', 가까운 순 */
export function buildEmergencyView(entries: GridEntry[], center: LatLon): ViewItem[] {
  return entries
    .map((e): ViewItem => ({ ...e, distanceM: distanceM(center, e), tier: 'open', emergency: true }))
    .sort((a, b) => a.distanceM - b.distanceM || a.id.localeCompare(b.id))
    .slice(0, EMERGENCY_LIMIT);
}

let emergencyList: Promise<GridEntry[]> | null = null;

/** 전국 응급실 목록을 한 번만 받는다. 실패하면 다음에 다시 시도한다 */
export function loadEmergency(fetchJson: FetchJson = defaultFetchJson): Promise<GridEntry[]> {
  emergencyList ??= fetchJson('/api/emergency')
    .then((p) => decodeGrid(p, 'hospital'))
    .catch((e: unknown) => {
      emergencyList = null;
      throw e;
    });
  return emergencyList;
}

export interface NearbyStep {
  entries: GridEntry[];
  radiusKm: number;
  done: boolean;
  /** 이 단계에서 받지 못한 칸 수(1km 첫 단계는 3km 단계가 다시 덮으므로 0으로 친다) */
  failed: number;
}

/**
 * 2단계 불러오기(D36): 1km 칸을 먼저 받아 알리고, 3km를 받아 알리고, 보여줄 곳이 5곳 미만이면 10km·25km로 넓힌다.
 * 서버로는 격자 번호만 간다(좌표 없음). isCurrent()가 false가 되면(지역·유형이 바뀜) 멈춘다.
 * match가 있으면(소아과·산부인과) 그 조건에 맞는 곳만 세어 넓힐지 정한다(D41).
 * 칸을 받지 못하면 더 넓히지 않고 멈춘다(실패한 채 넓히면 요청만 늘고, 빈 결과를 '없음'으로 오해하게 된다).
 */
export async function loadNearby(opts: {
  kind: Kind;
  match?: (e: GridEntry) => boolean;
  center: LatLon;
  at: () => Date;
  ctx: StatusContext;
  cache: CellCache;
  fetchJson?: FetchJson;
  isCurrent?: () => boolean;
  onStep: (s: NearbyStep) => void;
}): Promise<void> {
  const { kind, center, cache, fetchJson, onStep } = opts;
  const current = opts.isCurrent ?? (() => true);
  const first = await loadCells(kind, cellUrls(kind, center, FIRST_RADIUS_KM, 'fine'), cache, fetchJson);
  if (!current()) return;
  onStep({ entries: first.entries, radiusKm: FIRST_RADIUS_KM, done: false, failed: 0 });
  for (const [i, r] of RADII_KM.entries()) {
    const { entries, failed } = await loadCells(kind, cellUrls(kind, center, r, 'coarse'), cache, fetchJson);
    if (!current()) return;
    const last = failed > 0 || i === RADII_KM.length - 1 || visibleCount(entries, center, r, opts.at(), opts.ctx, opts.match) >= MIN_VISIBLE;
    onStep({ entries, radiusKm: r, done: last, failed });
    if (last) return;
  }
}

/** 이름이 같은 시군구(중구·동구 등)는 시도를 붙인다 */
const DUP_SIGUNGU = new Set(['중구', '동구', '서구', '남구', '북구', '강서구', '고성군']);

/** '마포구 망원동', '부산 중구 중앙동'. 서울 중구는 '중구'로(명동 기본값과 같은 모양). */
export function formatArea(sido: string | null, sigungu: string | null, dong: string | null): string {
  const parts: string[] = [];
  if (sigungu && DUP_SIGUNGU.has(sigungu) && sido && sido !== '서울특별시') parts.push(sidoShort(sido, sigungu));
  if (sigungu) parts.push(sigungu);
  if (dong && dong !== sigungu) parts.push(dong);
  return parts.join(' ') || (sido ?? '');
}

/** 가장 가까운 기관의 시도·시군구(D53, 지역으로 찾기의 '내 지역') */
export function areaRegion(center: LatLon, entries: GridEntry[]): { sido: string | null; sigungu: string | null } | null {
  let best: GridEntry | null = null;
  let bestD = Infinity;
  for (const e of entries) {
    const d = distanceM(center, e);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best ? { sido: best.sido, sigungu: best.sigungu } : null;
}

/** 현재 위치의 지역 이름: 가장 가까운 기관의 시군구·동(외부 주소 API 없음) */
export function areaLabel(center: LatLon, entries: GridEntry[]): string | null {
  let best: GridEntry | null = null;
  let bestD = Infinity;
  for (const e of entries) {
    const d = distanceM(center, e);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best ? formatArea(best.sido, best.sigungu, best.dong) : null;
}
