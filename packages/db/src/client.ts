import pg from 'pg';

/**
 * DB 연결은 pg(node-postgres)로 한다(P0-10). 쿼리 코드는 `sql\`… ${값}\`` 꼴을 그대로 쓰고,
 * 이 파일이 그것을 pg의 `$1` 매개변수로 바꿔 보낸다.
 * - `${값}`은 늘 매개변수다(문자열을 SQL에 이어 붙이지 않는다). 배열은 Postgres 배열로 간다.
 * - `${sql\`…\`}`처럼 조각을 넣으면 그 자리에 SQL로 펼친다.
 * - `sql.json(v)`는 JSON 문자열로 보낸다(배열도 jsonb로 쓰려면 이것을 쓴다).
 * - 결과는 행 배열이고, 영향받은 행 수는 `.count`에 있다.
 */

type Row = Record<string, unknown>;
export type Result<T extends readonly unknown[]> = T & { count: number };

class Json {
  readonly value: unknown;
  constructor(value: unknown) {
    this.value = value;
  }
}

/** 실행할 수 있는 SQL 조각. await하면 실행되고, 다른 쿼리 안에 넣으면 그 자리에 펼쳐진다. */
export class Query<T extends readonly unknown[] = Row[]> implements PromiseLike<Result<T>> {
  // 노드의 타입 제거 실행(워커·마이그레이션)은 생성자 매개변수 속성을 지원하지 않아 필드를 따로 둔다
  readonly strings: readonly string[];
  readonly values: readonly unknown[];
  private readonly run: Runner;

  constructor(strings: readonly string[], values: readonly unknown[], run: Runner) {
    this.strings = strings;
    this.values = values;
    this.run = run;
  }

  /** pg로 보낼 문장과 매개변수 */
  build(): { text: string; params: unknown[] } {
    const params: unknown[] = [];
    const text = render(this, params);
    return { text, params };
  }

  then<A = Result<T>, B = never>(
    onFulfilled?: ((v: Result<T>) => A | PromiseLike<A>) | null,
    onRejected?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): Promise<A | B> {
    const { text, params } = this.build();
    return this.run(text, params)
      // count는 열거되지 않게 붙인다(행 배열을 그대로 비교·펼칠 수 있게)
      .then((r) => Object.defineProperty([...r.rows], 'count', { value: r.rowCount ?? 0 }) as unknown as Result<T>)
      .then(onFulfilled, onRejected);
  }
}

function render(q: Query<readonly unknown[]>, params: unknown[]): string {
  let text = q.strings[0] ?? '';
  q.values.forEach((v, i) => {
    if (v instanceof Query) text += render(v, params);
    else {
      params.push(v instanceof Json ? JSON.stringify(v.value) : v);
      text += `$${params.length}`;
    }
    text += q.strings[i + 1] ?? '';
  });
  return text;
}

export interface Sql {
  <T extends readonly unknown[] = Row[]>(strings: TemplateStringsArray, ...values: unknown[]): Query<T>;
  json(value: unknown): Json;
  /** Postgres 배열 매개변수(pg는 JS 배열을 그대로 배열로 보낸다) */
  array<T>(value: readonly T[]): readonly T[];
  /** 매개변수 없는 여러 문장(마이그레이션용) */
  unsafe(text: string): Promise<void>;
  /** 한 연결에서 트랜잭션으로 실행한다 */
  begin<R>(fn: (tx: Sql) => Promise<R>): Promise<R>;
  end(): Promise<void>;
  readonly pool: pg.Pool;
}

type Runner = (text: string, params: unknown[]) => Promise<pg.QueryResult>;

function makeSql(pool: pg.Pool, run: Runner, begin: Sql['begin']): Sql {
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => new Query(strings, values, run)) as Sql;
  return Object.assign(sql, {
    json: (value: unknown) => new Json(value),
    array: <T>(value: readonly T[]) => value,
    unsafe: async (text: string) => {
      await run(text, []);
    },
    begin,
    end: () => pool.end(),
    pool,
  });
}

/** pool 위의 Sql. 트랜잭션은 연결 하나를 빌려 BEGIN/COMMIT으로 감싼다. */
export function sqlFromPool(pool: pg.Pool): Sql {
  const begin = async <R>(fn: (tx: Sql) => Promise<R>): Promise<R> => {
    const client = await pool.connect();
    const tx = makeSql(pool, (text, params) => client.query(text, params), () => {
      throw new Error('nested transaction');
    });
    try {
      await client.query('begin');
      const out = await fn(tx);
      await client.query('commit');
      return out;
    } catch (e) {
      await client.query('rollback').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  };
  return makeSql(pool, (text, params) => pool.query(text, params), begin);
}

/**
 * Supabase는 트랜잭션 풀러(6543)를 쓴다. pg는 이름 없는 문장만 보내므로 prepared statement 문제가 없다.
 * 웹(서버리스)은 연결 1개, 워커는 DB_POOL_MAX로 늘린다.
 */
export function createSql(url: string, max = 1, idleMs = 20_000): Sql {
  const pool = new pg.Pool({
    connectionString: url,
    max,
    idleTimeoutMillis: idleMs,
    connectionTimeoutMillis: 15_000,
  });
  // 쉬는 연결이 서버 쪽에서 끊기면 pool이 'error'를 낸다. 처리하지 않으면 프로세스가 죽으므로 버리기만 한다
  pool.on('error', () => {});
  return sqlFromPool(pool);
}

/**
 * 프로세스당 하나만 만든다. Next.js는 서버 코드 묶음마다 이 모듈을 따로 불러서,
 * 모듈 변수에 두면 웹 서버 하나가 연결을 여러 개 연다. 그래서 globalThis에 둔다.
 */
export interface PoolConfig {
  /** 쉬는 연결을 닫기까지(밀리초) */
  idleMs?: number;
  /** 새 pool을 만들 때마다 부른다(웹은 Vercel attachDatabasePool을 건다) */
  onCreate?: (pool: pg.Pool) => void;
}

const holder = globalThis as typeof globalThis & { __munyeonSql?: Sql; __munyeonPoolConfig?: PoolConfig };

/** getSql()이 새로 만드는 pool의 설정. 웹이 처음 조회하기 전에 부른다 */
export function configurePool(c: PoolConfig): void {
  holder.__munyeonPoolConfig = c;
}

export function getSql(): Sql {
  if (holder.__munyeonSql) return holder.__munyeonSql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const c = holder.__munyeonPoolConfig ?? {};
  const sql = createSql(url, Number(process.env.DB_POOL_MAX ?? 1), c.idleMs);
  c.onCreate?.(sql.pool);
  holder.__munyeonSql = sql;
  return sql;
}

/**
 * 공유 연결을 버린다. 다음 getSql()은 새로 연결한다(D47). 응답 없는 쿼리를 기다리지 않게 끝나기를 기다리지 않는다.
 */
export async function resetSql(): Promise<void> {
  const old = holder.__munyeonSql;
  holder.__munyeonSql = undefined;
  if (old) void old.end().catch(() => {});
}
