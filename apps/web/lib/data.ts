import {
  getHolidays, getInstitution, getLastSyncAt, getNearby, getRegionStats, getSql, listNeighborhoods, listRegion,
  listRegions, listSido, type Kind,
} from '@munyeon/db';
import { cache } from 'react';
import { withRetry } from './retry';

/**
 * 페이지에서 쓰는 DB 조회. React cache로 한 렌더 안의 중복(generateMetadata + page)을 없앤다.
 * 페이지 자체는 ISR로 캐시되므로(D30) 여기서는 따로 캐시하지 않는다.
 */

const ID_RE = /^[A-Za-z0-9]{1,20}$/;

export const loadInstitution = cache(async (kind: Kind, id: string) => {
  if (!ID_RE.test(id)) return null;
  return getInstitution(getSql(), kind, id);
});

export const loadNearby = cache(async (kind: Kind, id: string) => getNearby(getSql(), kind, id, 5, 3000));

export const loadLastSync = cache(async (kind: Kind) => getLastSyncAt(getSql(), kind));

function holidayRange(): [string, string] {
  const y = new Date(Date.now() + 9 * 3_600_000).getUTCFullYear();
  return [`${y}-01-01`, `${y + 1}-12-31`];
}

/** 올해·내년 공휴일. 정적 정보라 페이지에 넣어 캐시해도 된다(현재 상태 계산은 브라우저). */
export const loadHolidays = cache(async () => getHolidays(getSql(), ...holidayRange()));

/**
 * 메인 페이지 데이터(시도 목록·공휴일). 빌드 중 DB 조회가 취소되는 일이 있어 다시 시도하고(D47),
 * 그래도 안 되면 빈 목록으로 페이지를 만든다(빌드를 멈추지 않음). 메인은 1시간마다 다시 만들어져 곧 채워지고,
 * 공휴일은 브라우저가 /api/meta로 다시 받는다. React cache는 실패도 기억하므로 여기서는 쓰지 않는다.
 */
export async function loadHome(): Promise<[Awaited<ReturnType<typeof listSido>>, string[]]> {
  try {
    return await withRetry('home', () => Promise.all([listSido(getSql()), getHolidays(getSql(), ...holidayRange())]));
  } catch {
    console.error('[home] DB 조회를 포기하고 빈 목록으로 만듭니다');
    return [[], []];
  }
}

export const loadRegions = cache(async () => listRegions(getSql()));
export const loadRegion = cache(async (sido: string, sigungu: string, kind: Kind) => listRegion(getSql(), sido, sigungu, kind));
export const loadRegionStats = cache(async (sido: string, sigungu: string, kind: Kind) => getRegionStats(getSql(), sido, sigungu, kind));
export const loadNeighborhoods = cache(async () => listNeighborhoods(getSql()));
