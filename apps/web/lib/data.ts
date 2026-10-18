import {
  getHolidays, getInstitution, getLastSyncAt, getNearby, getRegionStats, getSql, listNeighborhoods, listRegion,
  listRegions, listSido, type Kind,
} from '@munyeon/db';
import { cache } from 'react';

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

/** 올해·내년 공휴일. 정적 정보라 페이지에 넣어 캐시해도 된다(현재 상태 계산은 브라우저). */
export const loadHolidays = cache(async () => {
  const y = new Date(Date.now() + 9 * 3_600_000).getUTCFullYear();
  return getHolidays(getSql(), `${y}-01-01`, `${y + 1}-12-31`);
});

export const loadSido = cache(async () => listSido(getSql()));
export const loadRegions = cache(async () => listRegions(getSql()));
export const loadRegion = cache(async (sido: string, sigungu: string, kind: Kind) => listRegion(getSql(), sido, sigungu, kind));
export const loadRegionStats = cache(async (sido: string, sigungu: string, kind: Kind) => getRegionStats(getSql(), sido, sigungu, kind));
export const loadNeighborhoods = cache(async () => listNeighborhoods(getSql()));
