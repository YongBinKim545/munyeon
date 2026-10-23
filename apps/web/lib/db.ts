import { attachDatabasePool } from '@vercel/functions';
import { configurePool, getSql, resetSql, type Sql } from '@munyeon/db';
import { withRetry } from './retry';

/**
 * 웹의 DB 조회는 모두 query()로 한다(D50).
 *
 * Vercel 함수는 요청이 없으면 얼려진다. 얼어 있는 동안 풀러가 연결을 끊으면 깨어난 함수가 죽은 연결로 쿼리를 보내
 * 응답 없이 기다렸다(2026-10-22 운영 상세 페이지 40~70초 무응답). 그래서(P0-10)
 * - 연결은 pg pool로 하고 Vercel attachDatabasePool을 건다. 함수가 얼기 전에 쉬는 연결을 닫아 죽은 연결이 남지 않는다.
 *   쉬는 연결은 POOL_IDLE_MS 뒤 닫는다(그동안 함수가 살아 있으므로 짧게).
 * - 조회마다 QUERY_TIMEOUT_MS 제한을 두어, 넘으면 연결을 버리고 새 연결로 한 번 더 시도한다.
 *   평소 조회는 1초 미만이라 3초로 둔다(D51). 실패하면 약 7초 안에 오류 화면이 나간다.
 */
export const POOL_IDLE_MS = 5_000;
export const QUERY_TIMEOUT_MS = 3_000;

configurePool({ idleMs: POOL_IDLE_MS, onCreate: (pool) => attachDatabasePool(pool) });

export type QueryOptions = Parameters<typeof withRetry>[2];

/**
 * DB 조회 하나. 기본은 3초 제한에 한 번 더 시도(대기 없음). 저장(insert)은 두 번 들어가지 않게 tries: 1로 부른다.
 * fn 안에서 여러 쿼리를 이어 써도 되지만, 제한 시간은 fn 전체에 걸린다.
 */
export function query<T>(label: string, fn: (sql: Sql) => Promise<T>, opts: QueryOptions = {}): Promise<T> {
  let used: Sql | undefined;
  return withRetry(
    label,
    () => fn((used = getSql())),
    {
      tries: 2,
      timeoutMs: QUERY_TIMEOUT_MS,
      wait: async () => {},
      // 다른 요청이 이미 새 연결로 바꿨으면 그 연결은 건드리지 않는다(동시에 실패한 요청끼리 서로의 재시도를 끊지 않게)
      reset: async () => {
        if (used === getSql()) await resetSql();
      },
      ...opts,
    },
  );
}
