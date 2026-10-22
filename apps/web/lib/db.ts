import { getSql, resetSql, type Sql } from '@munyeon/db';
import { withRetry } from './retry';

/**
 * 웹의 DB 조회는 모두 query()로 한다(D50).
 *
 * Vercel 함수는 요청이 없으면 얼려지고, 얼어 있는 동안에는 연결의 유휴 타이머도 멈춘다. 그사이 풀러가 연결을 끊으면
 * 깨어난 함수가 죽은 연결로 쿼리를 보내 응답 없이 기다리고, 연결이 하나뿐이라 그 인스턴스의 뒤 요청도 모두 멈췄다
 * (2026-10-22 운영 상세 페이지 40~70초 무응답). 그래서
 * - 마지막 조회가 끝나고 IDLE_RESET_MS보다 오래 쉬었으면(실제 시계 기준이라 얼어 있던 시간도 들어간다) 새로 연결하고,
 * - 조회마다 QUERY_TIMEOUT_MS 제한을 두어, 넘으면 연결을 버리고 새 연결로 한 번 더 시도한다.
 *   평소 조회는 1초 미만이라 3초로 둔다(D51, 처음엔 8초). 실패하면 약 7초 안에 오류 화면이 나간다.
 */
export const IDLE_RESET_MS = 10_000;
export const QUERY_TIMEOUT_MS = 3_000;

type Usage = { inflight: number; lastDoneAt: number };
const holder = globalThis as typeof globalThis & { __munyeonDbUsage?: Usage };
const usage = (): Usage => (holder.__munyeonDbUsage ??= { inflight: 0, lastDoneAt: 0 });

/** 쉬던 연결이면 버리고(진행 중인 조회가 없을 때만) 연결을 꺼낸다. 동시에 불려도 섞이지 않게 모두 동기로 처리한다. */
function acquire(now = Date.now()): Sql {
  const u = usage();
  if (u.inflight === 0 && u.lastDoneAt > 0 && now - u.lastDoneAt > IDLE_RESET_MS) void resetSql();
  u.inflight += 1;
  return getSql();
}

function release(): void {
  const u = usage();
  u.inflight -= 1;
  u.lastDoneAt = Date.now();
}

export type QueryOptions = Parameters<typeof withRetry>[2];

/**
 * DB 조회 하나. 기본은 3초 제한에 한 번 더 시도(대기 없음). 저장(insert)은 두 번 들어가지 않게 tries: 1로 부른다.
 * fn 안에서 여러 쿼리를 이어 써도 되지만, 제한 시간은 fn 전체에 걸린다.
 */
export function query<T>(label: string, fn: (sql: Sql) => Promise<T>, opts: QueryOptions = {}): Promise<T> {
  let used: Sql | undefined;
  return withRetry(
    label,
    async () => {
      const sql = (used = acquire());
      try {
        return await fn(sql);
      } finally {
        release();
      }
    },
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

/** 테스트용: 사용 기록을 지운다. */
export function resetDbUsage(): void {
  holder.__munyeonDbUsage = undefined;
}
