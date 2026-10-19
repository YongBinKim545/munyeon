import postgres from 'postgres';

export type Sql = postgres.Sql;

/**
 * 프로세스당 하나만 만든다. Next.js는 서버 코드 묶음마다 이 모듈을 따로 불러서,
 * 모듈 변수에 두면 웹 서버 하나가 연결을 여러 개 연다. 그래서 globalThis에 둔다.
 * 로컬 DB(PGlite)는 세션이 하나라 연결이 여럿이면 쿼리가 섞이고, 운영(Supabase 풀러)에서는 연결 자리를 아낀다.
 */
const holder = globalThis as typeof globalThis & { __munyeonSql?: Sql };

/**
 * DATABASE_URL로 연결한다. Supabase는 트랜잭션 풀러(6543)를 쓰므로 prepared statement를 끈다.
 * 웹(서버리스)은 연결 1개, 워커는 DB_POOL_MAX로 늘린다.
 */
export function getSql(): Sql {
  if (holder.__munyeonSql) return holder.__munyeonSql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  holder.__munyeonSql = createSql(url, Number(process.env.DB_POOL_MAX ?? 1));
  return holder.__munyeonSql;
}

export function createSql(url: string, max = 1): Sql {
  return postgres(url, { prepare: false, max, idle_timeout: 20, connect_timeout: 15, onnotice: () => {} });
}
