import postgres from 'postgres';

export type Sql = postgres.Sql;

let shared: Sql | undefined;

/**
 * DATABASE_URL로 연결한다. Supabase는 트랜잭션 풀러(6543)를 쓰므로 prepared statement를 끈다.
 * 웹(서버리스)은 연결 1개, 워커는 DB_POOL_MAX로 늘린다.
 */
export function getSql(): Sql {
  if (shared) return shared;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  shared = createSql(url, Number(process.env.DB_POOL_MAX ?? 1));
  return shared;
}

export function createSql(url: string, max = 1): Sql {
  return postgres(url, { prepare: false, max, idle_timeout: 20, connect_timeout: 15, onnotice: () => {} });
}
