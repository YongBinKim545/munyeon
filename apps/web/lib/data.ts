import {
  getHolidays, getInstitution, getLastSyncAt, getRegionStats, listNeighborhoods, listRegion,
  listRegions, listSido, type Kind,
} from '@munyeon/db';
import { cache } from 'react';
import { query } from './db';

/**
 * 페이지에서 쓰는 DB 조회. React cache로 한 렌더 안의 중복(generateMetadata + page)을 없앤다.
 * 페이지 자체는 ISR로 캐시되므로(D30) 여기서는 따로 캐시하지 않는다.
 * 모든 조회는 query()로 해서 시간 제한·새 연결 재시도를 받는다(D50).
 */

const ID_RE = /^[A-Za-z0-9]{1,20}$/;

export const loadInstitution = cache(async (kind: Kind, id: string) => {
  if (!ID_RE.test(id)) return null;
  return query('institution', (sql) => getInstitution(sql, kind, id));
});

export const loadLastSync = cache(async (kind: Kind) => query('lastSync', (sql) => getLastSyncAt(sql, kind)));

function holidayRange(): [string, string] {
  const y = new Date(Date.now() + 9 * 3_600_000).getUTCFullYear();
  return [`${y}-01-01`, `${y + 1}-12-31`];
}

/** 올해·내년 공휴일. 정적 정보라 페이지에 넣어 캐시해도 된다(현재 상태 계산은 브라우저). */
export const loadHolidays = cache(async () => query('holidays', (sql) => getHolidays(sql, ...holidayRange())));

/**
 * 메인 페이지 데이터(시도 목록·공휴일). 빌드 중 DB 조회가 취소되는 일이 있어 다시 시도하고(D47),
 * 그래도 안 되면 빈 목록으로 페이지를 만든다(빌드를 멈추지 않음). 메인은 1시간마다 다시 만들어져 곧 채워지고,
 * 공휴일은 브라우저가 /api/meta로 다시 받는다. React cache는 실패도 기억하므로 여기서는 쓰지 않는다.
 */
export async function loadHome(): Promise<[Awaited<ReturnType<typeof listSido>>, string[]]> {
  try {
    // 하나씩 조회하고, 다시 시도할 때는 연결을 새로 만든다(같은 연결로는 멈춘 일이 있었다)
    return await query(
      'home',
      async (sql) => [await listSido(sql), await getHolidays(sql, ...holidayRange())] as [Awaited<ReturnType<typeof listSido>>, string[]],
      { tries: 3, timeoutMs: 15_000, wait: (attempt) => new Promise<void>((r) => setTimeout(r, 1000 * attempt)) },
    );
  } catch {
    console.error('[home] DB 조회를 포기하고 빈 목록으로 만듭니다');
    return [[], []];
  }
}

export const loadRegions = cache(async () => query('regions', (sql) => listRegions(sql)));
export const loadRegion = cache(async (sido: string, sigungu: string, kind: Kind) => query('region', (sql) => listRegion(sql, sido, sigungu, kind)));
export const loadRegionStats = cache(async (sido: string, sigungu: string, kind: Kind) =>
  query('regionStats', (sql) => getRegionStats(sql, sido, sigungu, kind)),
);
export const loadNeighborhoods = cache(async () => query('neighborhoods', (sql) => listNeighborhoods(sql)));
